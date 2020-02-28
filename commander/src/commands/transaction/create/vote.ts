/*
 * LiskHQ/lisk-commander
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
	castVotes,
	utils as transactionUtils,
} from '@liskhq/lisk-transactions';
import {
	isValidFee,
	isValidNonce,
	validatePublicKeys,
} from '@liskhq/lisk-validator';
import { flags as flagParser } from '@oclif/command';

import BaseCommand from '../../../base';
import { ValidationError } from '../../../utils/error';
import { flags as commonFlags } from '../../../utils/flags';
import {
	getInputsFromSources,
	InputFromSourceOutput,
} from '../../../utils/input';
import { getData } from '../../../utils/input/utils';
import { getNetworkIdentifierWithInput } from '../../../utils/network_identifier';

const processInputs = (
	nonce: string,
	fee: string,
	networkIdentifier: string,
	votes: ReadonlyArray<string>,
	unvotes: ReadonlyArray<string>,
) => ({ passphrase }: InputFromSourceOutput) =>
	castVotes({
		nonce,
		fee,
		networkIdentifier,
		passphrase,
		votes,
		unvotes,
	});

interface Args {
	readonly nonce: string;
	readonly fee: string;
}

const processVotesInput = async (votes: string) =>
	votes.includes(':') ? getData(votes) : votes;

const processVotes = (votes: string) =>
	votes
		.replace(/\n/g, ',')
		.split(',')
		.filter(Boolean)
		.map(vote => vote.trim());

const getValidatedPublicKeys = (inputs: ReadonlyArray<string>) => {
	validatePublicKeys(inputs);

	return inputs;
};

export default class VoteCommand extends BaseCommand {
	static args = [
		{
			name: 'nonce',
			required: true,
			description: 'Nonce of the transaction.',
		},
		{
			name: 'fee',
			required: true,
			description: 'Transaction fee in LSK.',
		},
	];
	static description = `
	Creates a transaction which will cast votes (or unvotes) for delegate candidates using their public keys if broadcast to the network.
	`;

	static examples = [
		'transaction:create:vote 1 100 --votes 215b667a32a5cd51a94c9c2046c11fffb08c65748febec099451e3b164452bca,922fbfdd596fa78269bbcadc67ec2a1cc15fc929a19c462169568d7a3df1a1aa --unvotes e01b6b8a9b808ec3f67a638a2d3fa0fe1a9439b91dbdde92e2839c3327bd4589,ac09bc40c889f688f9158cca1fcfcdf6320f501242e0f7088d52a5077084ccba',
	];

	static flags = {
		...BaseCommand.flags,
		networkIdentifier: flagParser.string(commonFlags.networkIdentifier),
		passphrase: flagParser.string(commonFlags.passphrase),
		'no-signature': flagParser.boolean(commonFlags.noSignature),
		votes: flagParser.string(commonFlags.votes),
		unvotes: flagParser.string(commonFlags.unvotes),
	};

	async run(): Promise<void> {
		const {
			args,
			flags: {
				networkIdentifier: networkIdentifierSource,
				passphrase: passphraseSource,
				'no-signature': noSignature,
				votes,
				unvotes,
			},
		} = this.parse(VoteCommand);

		const { nonce, fee }: Args = args;

		if (!isValidNonce(nonce)) {
			throw new ValidationError('Enter a valid nonce in number string format.');
		}

		if (!isValidFee(fee)) {
			throw new ValidationError('Enter a valid fee in number string format.');
		}

		if (!votes && !unvotes) {
			throw new ValidationError(
				'At least one of votes and/or unvotes options must be provided.',
			);
		}

		if ((votes as string) === unvotes) {
			throw new ValidationError(
				'Votes and unvotes sources must not be the same.',
			);
		}

		const normalizedFee = transactionUtils.convertLSKToBeddows(fee);
		const processedVotesInput = votes
			? await processVotesInput(votes.toString())
			: undefined;
		const processedUnvotesInput = unvotes
			? await processVotesInput(unvotes.toString())
			: undefined;

		const validatedVotes = processedVotesInput
			? getValidatedPublicKeys(processVotes(processedVotesInput))
			: [];
		const validatedUnvotes = processedUnvotesInput
			? getValidatedPublicKeys(processVotes(processedUnvotesInput))
			: [];

		const networkIdentifier = getNetworkIdentifierWithInput(
			networkIdentifierSource,
			this.userConfig.api.network,
		);
		const processFunction = processInputs(
			nonce,
			normalizedFee,
			networkIdentifier,
			validatedVotes,
			validatedUnvotes,
		);

		if (noSignature) {
			const noSignatureResult = processFunction({
				passphrase: undefined,
			});
			this.print(noSignatureResult);

			return;
		}

		const inputs = await getInputsFromSources({
			passphrase: {
				source: passphraseSource,
				repeatPrompt: true,
			},
		});

		const result = processFunction(inputs);
		this.print(result);
	}
}
