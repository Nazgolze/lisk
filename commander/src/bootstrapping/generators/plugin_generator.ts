/*
 * LiskHQ/lisk-commander
 * Copyright © 2021 Lisk Foundation
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
import BaseGenerator from './base_generator';

export default class PluginGenerator extends BaseGenerator {
	public async initializing(): Promise<void> {
		await this._loadAndValidateTemplate();
	}

	public configuring(): void {
		this.log('Updating .liskrc.json file');
		this._liskRC.setPath('template', this._liskTemplateName);
	}

	public writing(): void {
		this.log('Creating plugin structure');
		this.composeWith({
			Generator: this._liskTemplate.generators.plugin,
			path: this._liskTemplatePath,
		},
		this._liskPluginArgs);
	}

	public end(): void {
		this.log('\n\n');
		this.log('Finished creating plugin');
	}
}
