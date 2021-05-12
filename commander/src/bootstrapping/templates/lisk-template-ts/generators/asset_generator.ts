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

import { join } from 'path';
import { Project } from 'ts-morph';
import * as Generator from 'yeoman-generator';

interface AssetGeneratorOptions extends Generator.GeneratorOptions {
	moduleName: string;
	assetName: string;
	assetID: number;
}

export default class AssetGenerator extends Generator {
	protected _moduleClass: string;
	protected _moduleName: string;
	protected _assetName: string;
	protected _assetID: number;
	protected _templatePath: string;
	protected _assetClass: string;

	public constructor(args: string | string[], opts: AssetGeneratorOptions) {
		super(args, opts);

		this._moduleName = opts.moduleName;
		this._assetName = opts.assetName;
		this._assetID = opts.assetID;
		this._templatePath = join(__dirname, '..', 'templates', 'asset');
		this._assetClass = `${this._assetName.charAt(0).toUpperCase() + this._assetName.slice(1)}Asset`;
		this._moduleClass = `${
			this._moduleName.charAt(0).toUpperCase() + this._moduleName.slice(1)
		}Module`;
	}

	public writing(): void {
		// Writing asset file
		this.fs.copyTpl(
			`${this._templatePath}/src/app/modules/assets/asset.ts`,
			this.destinationPath(
				`src/app/modules/${this._moduleName}/assets/${this._assetName}_asset.ts`,
			),
			{
				moduleName: this._moduleName,
				assetName: this._assetName,
				assetClass: this._assetClass,
				assetID: this._assetID,
			},
			{},
			{ globOptions: { dot: true, ignore: ['.DS_Store'] } },
		);

		// Writing test file for the generated asset
		this.fs.copyTpl(
			`${this._templatePath}/test/unit/modules/assets/asset.spec.ts`,
			this.destinationPath(
				`test/unit/modules/${this._moduleName}/assets/${this._assetName}_asset.spec.ts`,
			),
			{
				moduleName: this._moduleName,
				assetName: this._assetName,
				assetClass: this._assetClass,
				assetID: this._assetID,
			},
			{},
			{ globOptions: { dot: true, ignore: ['.DS_Store'] } },
		);
	}

	public async registerAsset() {
		this.log('Registering asset...');

		const project = new Project();
		project.addSourceFilesAtPaths('src/app/**/*.ts');

		const moduleFile = project.getSourceFileOrThrow(
			`src/app/modules/${this._moduleName}/${this._moduleName}_module.ts`,
		);

		moduleFile.addImportDeclaration({
			namedImports: [this._assetClass],
			moduleSpecifier: `./assets/${this._assetName}`,
		});

		const moduleClass = moduleFile.getClassOrThrow(this._moduleClass);
		const property = moduleClass.getInstancePropertyOrThrow('transactionAssets');
		const value = (property.getStructure() as { initializer: string }).initializer;

		if (value === '[]' || value === '') {
			property.set({ initializer: `[new ${this._assetClass}()]` });
		} else if (value.endsWith(']')) {
			property.set({ initializer: `${value.slice(0, -1)}, new ${this._assetClass}()]` });
		} else {
			this.log('Asset can not be registered. Please register it by yourself.');
		}

		moduleFile.organizeImports();

		await moduleFile.save();
	}
}
