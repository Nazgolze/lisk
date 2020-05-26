/*
 * Copyright © 2019 Lisk Foundation
 *
 * See the LICENSE file at the top-level directory of this distribution
 * for licensing information.
 *
 * Unless otherwise agreed in a custom licensing agreement with the Lisk Foundation,
 * no part of this software, including this file, may be copied, modified,
 * propagated, or distributed except according to the terms contained in the
 * LICENSE file.
 *
 * Removal or modification of this copyright notice is prohibited.
 *
 */

import {
	getAddressAndPublicKeyFromPassphrase,
	getAddressFromPublicKey,
	hexToBuffer,
	intToBuffer,
	signData,
} from '@liskhq/lisk-cryptography';
import { validator } from '@liskhq/lisk-validator';

import { BaseTransaction, StateStore } from './base_transaction';
import { convertToAssetError, TransactionError } from './errors';
import { createResponse, TransactionResponse } from './response';
import { TransactionJSON, AssetSchema } from './types';
import {
	buildPublicKeyPassphraseDict,
	getId,
	sortKeysAscending,
	validateKeysSignatures,
	validateSignature,
} from './utils';

export const multisigRegAssetSchema = {
	type: 'object',
	required: ['numberOfSignatures', 'optionalKeys', 'mandatoryKeys'],
	properties: {
		numberOfSignatures: {
			dataType: 'uint32',
			fieldNumber: 1,
		},
		mandatoryKeys: {
			type: 'array',
			items: {
				dataType: 'bytes',
			},
			fieldNumber: 2,
		},
		optionalKeys: {
			type: 'array',
			items: {
				dataType: 'bytes',
			},
			fieldNumber: 3,
		},
	},
};

const setMemberAccounts = async (
	store: StateStore,
	membersPublicKeys: ReadonlyArray<string>,
): Promise<void> => {
	for (const memberPublicKey of membersPublicKeys) {
		const address = getAddressFromPublicKey(memberPublicKey);
		// Key might not exists in the blockchain yet so we fetch or default
		const memberAccount = await store.account.getOrDefault(address);
		memberAccount.publicKey = memberAccount.publicKey ?? memberPublicKey;
		store.account.set(memberAccount.address, memberAccount);
	}
};

export interface MultiSignatureAsset {
	mandatoryKeys: Array<Readonly<string>>;
	optionalKeys: Array<Readonly<string>>;
	readonly numberOfSignatures: number;
}

export class MultisignatureTransaction extends BaseTransaction {
	public static TYPE = 12;
	public readonly asset: MultiSignatureAsset;
	public readonly assetSchema: AssetSchema;
	private readonly MAX_KEYS_COUNT = 64;

	public constructor(rawTransaction: unknown) {
		super(rawTransaction);

		this.assetSchema = multisigRegAssetSchema;
		const tx = (typeof rawTransaction === 'object' && rawTransaction !== null
			? rawTransaction
			: {}) as Partial<TransactionJSON>;
		this.asset = (tx.asset ?? {}) as MultiSignatureAsset;
	}

	// Verifies multisig signatures as per LIP-0017
	// eslint-disable-next-line @typescript-eslint/require-await
	public async verifySignatures(
		store: StateStore,
	): Promise<TransactionResponse> {
		const { networkIdentifier } = store.chain;
		const transactionBytes = this.getBasicBytes();
		const networkIdentifierBytes = hexToBuffer(networkIdentifier);
		const transactionWithNetworkIdentifierBytes = Buffer.concat([
			networkIdentifierBytes,
			transactionBytes,
		]);

		const { mandatoryKeys, optionalKeys } = this.asset;

		// For multisig registration we need all signatures to be present
		if (
			mandatoryKeys.length + optionalKeys.length + 1 !==
			this.signatures.length
		) {
			return createResponse(this.id, [
				new TransactionError('There are missing signatures'),
			]);
		}

		// Check if empty signatures are present
		if (this.signatures.includes('')) {
			return createResponse(this.id, [
				new TransactionError(
					'A signature is required for each registered key.',
				),
			]);
		}

		// Verify first signature is from senderPublicKey
		const { valid, error } = validateSignature(
			this.senderPublicKey,
			this.signatures[0],
			transactionWithNetworkIdentifierBytes,
		);

		if (!valid) {
			return createResponse(this.id, [error as TransactionError]);
		}

		// Verify each mandatory key signed in order
		const mandatorySignaturesErrors = validateKeysSignatures(
			mandatoryKeys,
			this.signatures.slice(1, mandatoryKeys.length + 1),
			transactionWithNetworkIdentifierBytes,
		);

		if (mandatorySignaturesErrors.length) {
			return createResponse(this.id, mandatorySignaturesErrors);
		}
		// Verify each optional key signed in order
		const optionalSignaturesErrors = validateKeysSignatures(
			optionalKeys,
			this.signatures.slice(mandatoryKeys.length + 1),
			transactionWithNetworkIdentifierBytes,
		);
		if (optionalSignaturesErrors.length) {
			return createResponse(this.id, optionalSignaturesErrors);
		}

		return createResponse(this.id, []);
	}

	public sign(
		networkIdentifier: string,
		senderPassphrase: string,
		passphrases?: ReadonlyArray<string>,
		keys?: {
			readonly mandatoryKeys: Array<Readonly<string>>;
			readonly optionalKeys: Array<Readonly<string>>;
			readonly numberOfSignatures: number;
		},
	): void {
		// Sort the keys in the transaction
		sortKeysAscending(this.asset.mandatoryKeys);
		sortKeysAscending(this.asset.optionalKeys);

		// Sign with sender
		const { publicKey } = getAddressAndPublicKeyFromPassphrase(
			senderPassphrase,
		);

		if (this.senderPublicKey !== '' && this.senderPublicKey !== publicKey) {
			throw new Error(
				'Transaction senderPublicKey does not match public key from passphrase',
			);
		}

		this.senderPublicKey = publicKey;

		const networkIdentifierBytes = hexToBuffer(networkIdentifier);
		const transactionWithNetworkIdentifierBytes = Buffer.concat([
			networkIdentifierBytes,
			this.getBasicBytes(),
		]);

		this.signatures.push(
			signData(transactionWithNetworkIdentifierBytes, senderPassphrase),
		);

		// Sign with members
		if (keys && passphrases) {
			const keysAndPassphrases = buildPublicKeyPassphraseDict([...passphrases]);
			// Make sure passed in keys are sorted
			sortKeysAscending(keys.mandatoryKeys);
			sortKeysAscending(keys.optionalKeys);
			// Sign with all keys
			for (const aKey of [...keys.mandatoryKeys, ...keys.optionalKeys]) {
				// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
				if (keysAndPassphrases[aKey]) {
					const { passphrase } = keysAndPassphrases[aKey];
					this.signatures.push(
						signData(transactionWithNetworkIdentifierBytes, passphrase),
					);
				} else {
					// Push an empty signature if a passphrase is missing
					this.signatures.push('');
				}
			}
		}
		this._id = getId(this.getBytes());
	}

	protected assetToBytes(): Buffer {
		const { mandatoryKeys, optionalKeys, numberOfSignatures } = this.asset;
		const mandatoryKeysBuffer = Buffer.from(mandatoryKeys.join(''), 'hex');
		const optionalKeysBuffer = Buffer.from(optionalKeys.join(''), 'hex');
		const assetBuffer = Buffer.concat([
			intToBuffer(mandatoryKeys.length, 1),
			mandatoryKeysBuffer,
			intToBuffer(optionalKeys.length, 1),
			optionalKeysBuffer,
			intToBuffer(numberOfSignatures, 1),
		]);

		return assetBuffer;
	}

	protected verifyAgainstTransactions(
		transactions: ReadonlyArray<TransactionJSON>,
	): ReadonlyArray<TransactionError> {
		const errors = transactions
			.filter(
				tx =>
					tx.type === this.type && tx.senderPublicKey === this.senderPublicKey,
			)
			.map(
				tx =>
					new TransactionError(
						'Register multisignature only allowed once per account.',
						tx.id,
						'.asset.multisignature',
					),
			);

		return errors;
	}

	protected validateAsset(): ReadonlyArray<TransactionError> {
		const schemaErrors = validator.validate(
			multisigRegAssetSchema,
			this.asset,
		);
		const errors = convertToAssetError(
			this.id,
			schemaErrors,
		) as TransactionError[];

		if (errors.length > 0) {
			return errors;
		}

		const { mandatoryKeys, optionalKeys, numberOfSignatures } = this.asset;

		// Check if key count is less than number of required signatures
		if (mandatoryKeys.length + optionalKeys.length < numberOfSignatures) {
			errors.push(
				new TransactionError(
					'The numberOfSignatures is bigger than the count of Mandatory and Optional keys',
					this.id,
					'.asset.numberOfSignatures',
					this.asset.numberOfSignatures,
				),
			);
		}

		// Check if key count is less than 1
		if (
			mandatoryKeys.length + optionalKeys.length > this.MAX_KEYS_COUNT ||
			mandatoryKeys.length + optionalKeys.length <= 0
		) {
			errors.push(
				new TransactionError(
					'The count of Mandatory and Optional keys should be between 1 and 64',
					this.id,
					'.asset.optionalKeys .asset.mandatoryKeys',
					this.asset.numberOfSignatures,
				),
			);
		}

		// The numberOfSignatures needs to be equal or bigger than number of mandatoryKeys
		if (mandatoryKeys.length > numberOfSignatures) {
			errors.push(
				new TransactionError(
					'The numberOfSignatures needs to be equal or bigger than the number of Mandatory keys',
					this.id,
					'.asset.numberOfSignatures',
					this.asset.numberOfSignatures,
				),
			);
		}

		if (errors.length > 0) {
			return errors;
		}

		// Check if keys are repeated between mandatory and optional key sets
		const repeatedKeys = mandatoryKeys.filter(value =>
			optionalKeys.includes(value),
		);
		if (repeatedKeys.length > 0) {
			errors.push(
				new TransactionError(
					'Invalid combination of Mandatory and Optional keys',
					this.id,
					'.asset.mandatoryKeys, .asset.optionalKeys',
					repeatedKeys.join(', '),
				),
			);
		}

		if (errors.length > 0) {
			return errors;
		}

		// Check if the length of mandatory, optional and sender keys matches the length of signatures
		if (
			mandatoryKeys.length + optionalKeys.length + 1 !==
			this.signatures.length
		) {
			return [
				new TransactionError(
					'The number of mandatory, optional and sender keys should match the number of signatures',
					this.id,
				),
			];
		}

		// Check keys are sorted lexicographically
		// eslint-disable-next-line @typescript-eslint/require-array-sort-compare
		const sortedMandatoryKeys = [...mandatoryKeys].sort();
		// eslint-disable-next-line @typescript-eslint/require-array-sort-compare
		const sortedOptionalKeys = [...optionalKeys].sort();
		for (let i = 0; i < sortedMandatoryKeys.length; i += 1) {
			if (mandatoryKeys[i] !== sortedMandatoryKeys[i]) {
				errors.push(
					new TransactionError(
						'Mandatory keys should be sorted lexicographically',
						this.id,
						'.asset.mandatoryKeys',
						mandatoryKeys.join(', '),
					),
				);
				break;
			}
		}

		for (let i = 0; i < sortedOptionalKeys.length; i += 1) {
			if (optionalKeys[i] !== sortedOptionalKeys[i]) {
				errors.push(
					new TransactionError(
						'Optional keys should be sorted lexicographically',
						this.id,
						'.asset.optionalKeys',
						optionalKeys.join(', '),
					),
				);
				break;
			}
		}

		return errors;
	}

	protected async applyAsset(
		store: StateStore,
	): Promise<ReadonlyArray<TransactionError>> {
		const errors: TransactionError[] = [];
		const sender = await store.account.get(this.senderId);

		// Check if multisignatures already exists on account
		if (sender.keys.numberOfSignatures > 0) {
			errors.push(
				new TransactionError(
					'Register multisignature only allowed once per account.',
					this.id,
					'.signatures',
				),
			);
		}

		sender.keys = {
			numberOfSignatures: this.asset.numberOfSignatures,
			mandatoryKeys: this.asset.mandatoryKeys,
			optionalKeys: this.asset.optionalKeys,
		};

		store.account.set(sender.address, sender);

		// Cache all members public keys
		await setMemberAccounts(store, sender.keys.mandatoryKeys);
		await setMemberAccounts(store, sender.keys.optionalKeys);

		return errors;
	}

	protected async undoAsset(
		store: StateStore,
	): Promise<ReadonlyArray<TransactionError>> {
		const sender = await store.account.get(this.senderId);
		sender.keys = {
			mandatoryKeys: [],
			optionalKeys: [],
			numberOfSignatures: 0,
		};

		store.account.set(sender.address, sender);

		return [];
	}
}
