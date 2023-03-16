/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QuickPickItem, window, QuickInputButton, ExtensionContext, Uri, ProgressLocation, workspace } from 'vscode';
import { ProjectStepInput } from './baseProjectWizard';
import { spawnSync } from 'child_process';
import { findJavaHomes, JavaRuntime } from '../java-runtime/findJavaHomes';
import Constants from '../constants';
import { downloadFile, findDirectoriesContaining, findMatchingWorkspaceFolder, getCurrentWorkspacePath, getJavaExecutable, getProductInfos, getProperties, parseXml, refreshWorkspaceView } from '../liferayUtils';
import * as vscode from 'vscode';
import path = require('path');
import { isLiferayGradleWorkspace } from '../workspaceUtil';
import * as xml2js from "xml2js";
import * as fs from 'fs';
import * as cheerio from "cheerio";
import * as crypto from 'crypto';
import { Hash } from 'crypto';

export async function createLiferayClientExtensionProject(context: ExtensionContext) {

	class MyButton implements QuickInputButton {
		constructor(public iconPath: { light: Uri; dark: Uri; }, public tooltip: string) { }
	}

	const createResourceGroupButton = new MyButton({
		dark: Uri.file(context.asAbsolutePath('resources/dark/add.svg')),
		light: Uri.file(context.asAbsolutePath('resources/light/add.svg')),
	}, 'Create Resource Group');

	interface State {
		title: string;
		step: number;
		totalSteps: number;
		extensionType: QuickPickItem | string;
		name: string;
		extensionName: string;
	}

	async function initLiferayClientExtension() {
		const state = {} as Partial<State>;
		await ProjectStepInput.run(input => setClientExtensionProjectName(input, state));
		return state as State;
	}

	const title = 'Create Liferay Client Extension Project';

	async function setLiferayClientExtensinType(input: ProjectStepInput, state: Partial<State>) {
		const loadingItems: QuickPickItem[] = [{ label: 'Loading.....', description: 'Wait to load liferay client extension types' }];
		const pick = await input.showQuickPick({
			title,
			step: 2,
			totalSteps: 3,
			placeholder: 'Choose a liferay client extenstion type:',
			items: loadingItems,
			activeItem: typeof state.extensionType !== 'string' ? state.extensionType : undefined,
			buttons: [],
			shouldResume: shouldResume,
			initQuickItems: getAvailableClientExtensinTypes
		});
		state.extensionType = pick;
		return (input: ProjectStepInput) => setLifreayClientExtensionName(input, state);
	}

	async function getExtensionMetadataFile(): Promise<string>{


		return "";
	}

	function getWorkspaceProduct():string{
		const workspacePath = getCurrentWorkspacePath();

		if (!workspacePath){
			throw new Error("Failed to get current workspace project path");
		}

		let workspaceProuct: string = "";		

		if (!workspacePath){
			if (isLiferayGradleWorkspace(workspacePath)){
				const gradlePropertiesPath = path.join(workspacePath, "gradle.properties");

				const gradleProperties = getProperties(gradlePropertiesPath);

				workspaceProuct = gradleProperties[Constants.LIFERAY_WORKSPACE_PRODUCT];
			}
		}

		return workspaceProuct;
	}


	async function creatSha256(file: string): Promise<string>{
		const hash = crypto.createHash('sha256');
		const input = fs.createReadStream(file);
		
		input.on('readable', () => {
			const data = input.read();
			if (data) {
				hash.update(data);
			} else {
				throw new Error(`Failed to calculate SHA256 for file.${file}`);
			}
		});

		return hash.digest('hex');
	}

	async function getLxc(): Promise<string> {
		const lxcUrl = Constants.LXC_DOWNLOAD_URL;

		const archType = process.platform;

		let lxcName: string;

		switch (archType) {
			case 'win32':
				lxcName = "/lxc-win";
			break;
			case 'linux':
				lxcName = "lxc-linux";
			break;
			case 'darwin':
				lxcName = "lxc-macos";
			break;
			default:
			throw new Error("Your platform is not supported.");
		}
		
		const lxcDownloadUrl = lxcUrl.concat(lxcName).concat(".tgz");

		const lxcDownloadChecksumUrl = lxcDownloadUrl.concat(".checksum");

		const lxcDowanloadPath = await downloadFile(lxcDownloadUrl, Constants.CLIENT_EXTENSION_CACHE_DIR, lxcName);

		const lxcDowanloadChecksumPath = await downloadFile(lxcDownloadChecksumUrl, Constants.CLIENT_EXTENSION_CACHE_DIR, lxcName.concat(".checksum"));

		if (fs.existsSync(lxcDowanloadChecksumPath) && fs.existsSync(lxcDowanloadPath)){
			const sha256 = await creatSha256(lxcDowanloadPath);

			const lxcChecksum = fs.readdirSync(lxcDowanloadChecksumPath);

			if (sha256 === lxcChecksum[0]){
				return lxcDowanloadPath;
			}

			throw new Error("Failed to verify check sum lxc.");
		}

		// const vscode_java_pack = vscode.extensions.getExtension("vscjava.vscode-java-pack");
		// const extension = vscode.extensions.getExtension("vscjava.vscode-java-pack");

		// if (extension) {
		//   const mavenExtension = extension.exports.maven;
		//   if (mavenExtension) {
		//     mavenExtension.executeMavenCommand("clean");
		//   }
		// }


		throw new Error("Failed to download lxc.");

	}

	async function getAvailableClientExtensinTypes(): Promise<QuickPickItem[]> {
		const lxcPath = await getLxc();

		const workspacePath = getCurrentWorkspacePath();

		let moduleTypes: string[] = [];		

		if (!workspacePath){
			return moduleTypes.map(label => ({ label }));
		}

		const productKey = getWorkspaceProduct();

		console.log("productKey is " + productKey);

		const productInfos = await getProductInfos();

		const productInfo = productInfos.get(productKey);

		const targetPlatformVersion = productInfo?.targetPlatformVersion;

		const releaseBomFileUrl = Constants.BASE_BOM_URL + "release." + productKey + ".bom/" + targetPlatformVersion + "/release." + productKey + ".bom-" + targetPlatformVersion + ".pom";

        const releaseBomPath = await downloadFile(releaseBomFileUrl, Constants.CLIENT_EXTENSION_CACHE_DIR, "release." + productKey + ".bom-" + targetPlatformVersion + ".pom");

		const clientExtensionApiJarVersion = await parseXml(releaseBomPath, "artifactId:contains(com.liferay.client.extension.type.api");

		const clientExtensionApiJarDownloaUrl = "https://repository-cdn.liferay.com/nexus/service/local/repositories/liferay-public-releases" +
		"/content/com/liferay/com.liferay.client.extension.type.api/" + clientExtensionApiJarVersion +
			"/com.liferay.client.extension.type.api-" + clientExtensionApiJarVersion + ".jar";

		const clientExtensionApiJarPath = await downloadFile(clientExtensionApiJarDownloaUrl, Constants.CLIENT_EXTENSION_CACHE_DIR, "com.liferay.client.extension.type.api-" + clientExtensionApiJarVersion + ".jar");
		
		// const result  = spawnSync(getJavaExecutable(javahome[0]), ['-jar', bladeJarPath, 'create', '-l'], { encoding: 'utf-8' });

		// if (result.status !== 0) {
		// 	console.error(result.stderr);
		// }

		// moduleTypes =  result.stdout.split('\n');

		return moduleTypes.map(label => ({ label }));
	}

	async function setClientExtensionProjectName(input: ProjectStepInput, state: Partial<State>) {
		state.name = await input.showInputBox({
			title,
			step: 1,
			totalSteps: 3,
			value: state.name || '',
			prompt: 'Choose a unique name for Liferay Client Extension Project',
			validate: validateNameIsUnique,
			shouldResume: shouldResume
		});
		return (input: ProjectStepInput) => setLiferayClientExtensinType(input, state);
	}


	async function setLifreayClientExtensionName(input: ProjectStepInput, state: Partial<State>) {
		state.extensionName = await input.showInputBox({
			title,
			step: 3,
			totalSteps: 3,
			value: state.extensionName || '',
			prompt: 'Choose a client extension name',
			validate: validateNameIsUnique,
			shouldResume: shouldResume
		});
	}

	function shouldResume() {
		// Could show a notification with the option to resume.
		return new Promise<boolean>((_resolve, _reject) => {

		});
	}

	async function validateNameIsUnique(name: string) {
		const result = findMatchingWorkspaceFolder(name);
		if (result && result.match) {
			return 'Name not unique';
		}
		return undefined;
	}

	async function lxcCreateClientExtensionProject(): Promise<void> {
		const bladeJarPath = await downloadFile(Constants.BLADE_DOWNLOAD_URL, Constants.BLADE_CACHE_DIR, Constants.BALDE_JAR_NAME);
		let javahome : JavaRuntime[] = await findJavaHomes();

		let moduleType = state.extensionType as QuickPickItem;

		let moduleTypeString = moduleType.label;

		const index = moduleTypeString.indexOf(" ");

		const type = moduleTypeString.substring(0, index);

		console.log("module type is " + type);

		let currentLiferayWorkspacePorjectPath = getCurrentWorkspacePath();

		if (!currentLiferayWorkspacePorjectPath || currentLiferayWorkspacePorjectPath === undefined){
			throw new Error(`Failed to create Liferay Module Project.`);
		}

		const result  = spawnSync(getJavaExecutable(javahome[0]), ['-jar', bladeJarPath, 'create', '-t', type, '--base', currentLiferayWorkspacePorjectPath], { encoding: 'utf-8' });

		if (result.status !== 0) {
			throw new Error(`Failed to create a ${type} liferay worksapce project for ${state.name}`);
		}

		refreshWorkspaceView();
	}

	const state = await initLiferayClientExtension();

	lxcCreateClientExtensionProject();

	window.showInformationMessage(`Creating Application Service '${state.name}'`);
}
