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
 */

export const CommonBlock = {
	id: 'CommonBlock',
	type: 'string',
	format: 'hex',
};

export const WSBlocksList = {
	id: 'WSBlocksList',
	type: 'array',
	items: {
		type: 'string',
		format: 'hex',
	},
};

export const WSTransactionsResponse = {
	id: 'WSTransactionsResponse',
	type: 'object',
	required: ['transactions'],
	properties: {
		transactions: {
			type: 'array',
			uniqueItems: true,
			maxItems: 100,
			items: {
				type: 'string',
				format: 'hex',
			},
		},
	},
};
