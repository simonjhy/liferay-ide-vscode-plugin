/* eslint-disable @typescript-eslint/naming-convention */

import { QuickPickItem, window, ExtensionContext, Uri } from 'vscode';
import { ExtraButton, ProjectStepInput } from './baseProjectWizard';
import { SpawnSyncOptionsWithStringEncoding, exec, spawnSync } from 'child_process';
import Constants from '../constants';
import { downloadFile, findMatchingWorkspaceFolder,  findTagsWithCssSelector,  getCurrentWorkspacePath, getProductInfos, refreshWorkspaceView } from '../liferayUtils';
import path = require('path');
import { isLiferayGradleWorkspace } from '../workspaceUtil';
import * as fs from 'fs';
import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import * as properties from "properties-parser";
import * as os from 'os';
import * as zlib from 'zlib';
import * as tar from 'tar';
import * as yauzl from 'yauzl';
import { unzip } from 'lodash';
import * as unzipper from 'unzipper';
import { LiferayConfigManager } from '../core/liferayCore';

export async function createLiferayClientExtensionProject(context: ExtensionContext) {

	const CreateSampleClientExtensionButton = new ExtraButton({
		dark: Uri.file(context.asAbsolutePath('resources/dark/add.svg')),
		light: Uri.file(context.asAbsolutePath('resources/light/add.svg')),
	}, 'Create Client Extension Sample');

	interface State {
		title: string;
		step: number;
		totalSteps: number;
		extensionType: QuickPickItem | string;
		name: string;
		extensionName: string;
		sampleExtensionType: QuickPickItem | string;
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
			placeholder: 'Choose a Liferay Client Extenstion Type:',
			items: loadingItems,
			activeItem: typeof state.extensionType !== 'string' ? state.extensionType : undefined,
			buttons: [],
			shouldResume: shouldResume,
			initQuickItems: getAvailableClientExtensinTypes
		});

		state.extensionType = pick;
		return (input: ProjectStepInput) => setLifreayClientExtensionName(input, state);
	}

	async function setClientExtensionProjectName(input: ProjectStepInput, state: Partial<State>) {
		const pick = await input.showInputBox({
			title,
			step: 1,
			totalSteps: 3,
			value: state.name || '',
			prompt: 'Choose a unique name for Liferay Client Extension Project',
			validate: validateNameIsUnique,
			buttons: [CreateSampleClientExtensionButton],
			shouldResume: shouldResume
		});
		if (pick instanceof ExtraButton) {
			return (input: ProjectStepInput) => createClientExtensionFromSampleWorkspace(input, state);
		}

		state.name = pick;
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

	async function createClientExtensionFromSampleWorkspace(input: ProjectStepInput, state: Partial<State>) {
		const loadingItems: QuickPickItem[] = [{ label: 'Loading.....', description: 'Wait to load liferay sample client extension types' }];
		state.sampleExtensionType = await input.showQuickPick({
			title,
			step: 1,
			totalSteps: 1,
			placeholder: 'Choose a Liferay Sample Client Extenstion Type:',
			items: loadingItems,
			activeItem: typeof state.sampleExtensionType !== 'string' ? state.sampleExtensionType : undefined,
			buttons: [],
			shouldResume: shouldResume,
			initQuickItems: getAvailableSampleClientExtensinTypes
		});
	}

	async function getAvailableSampleClientExtensinTypes(): Promise<QuickPickItem[]> {
		const sampleClientExtensionWorkspacePath = await downloadFile(Constants.sampleClientExtensionUrl, Constants.IDE_VSCODE_PLUGIN_CACHE_DIR, "com.sample.workspace.client.extension.zip");

		const sampleClientExtensionTypes = new Set<string>();
		await listZipEntries(sampleClientExtensionWorkspacePath).then((entries) => {
			entries.filter((entry) => {
					const parts = entry.split('/');
					return parts.length === 3 && parts[0] === 'client-extensions';
				})
				.map(item => {
					const parts = item.split('/');
					return parts[1];
				})
				.forEach(item =>{
					sampleClientExtensionTypes.add(item);
				});
  		});
		return Array.from(sampleClientExtensionTypes).map(label => ({ label }));
	}

	async function unpackTgz(zipPath: string, output: string){
		if (!fs.existsSync(output)) {
			fs.mkdirSync(output);
		}

		const unzip = zlib.createUnzip();
		const untar = tar.extract({
			cwd: output, 
		});

		const readStream = fs.createReadStream(zipPath);

		readStream.pipe(unzip)
			.pipe(untar)
			.on('error', (err) => {
				console.error('Failed unzip：', err);
			})
			.on('close', () => {
				console.log('Finish unzip.');
		});
	}

	function getWorkspaceProduct():any{
		const workspacePath = getCurrentWorkspacePath();

		if (!workspacePath){
			throw new Error("Failed to get current workspace project path");
		}

		if (workspacePath){
			if (isLiferayGradleWorkspace(workspacePath)){
				const gradlePropertiesPath = path.join(workspacePath, "gradle.properties");
				const props = properties.read(gradlePropertiesPath);
				return props[Constants.LIFERAY_WORKSPACE_PRODUCT];
			}
		}

		return null;
	}

	async function createSha256(file: string): Promise<string> {
	  const stream = createReadStream(file);
	  const hash = createHash('sha256');
	  return new Promise((resolve, reject) => {
		stream.on('data', (chunk: Buffer) => {
		  hash.update(chunk);
		});
		stream.on('end', () => {
		  const digest = hash.digest('hex');
		  resolve(digest);
		});
		stream.on('error', (err: Error) => {
		  reject(err);
		});
	  });
	}

	async function getLxc(): Promise<string> {
		const lxcCacheDir = path.join(os.homedir(), Constants.IDE_VSCODE_PLUGIN_CACHE_DIR);

		const lxcUnzipPath = path.join(lxcCacheDir, "lxc");
		let  lxcFilePath = path.join(lxcUnzipPath, 'lxc');

		const archType = process.platform;
		switch (archType) {
			case 'win32':
				lxcFilePath = lxcFilePath.concat('.exe');
				break;
			break;
			case 'linux':
			case 'darwin':
			break;
			default:
		}

		if (fs.existsSync(lxcFilePath)){
			return lxcFilePath;
		}

		const lxcUrl = Constants.LXC_DOWNLOAD_URL;

		let lxcName: string;

		switch (archType) {
			case 'win32':
				lxcName = "lxc-win";
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

		
		const lxcZipPath = path.join(lxcCacheDir, lxcName).concat(".tgz");
		const lxcZipChecksumPath = path.join(lxcCacheDir, lxcName).concat(".tgz").concat(".checksum");

		if (fs.existsSync(lxcZipPath) && fs.existsSync(lxcZipChecksumPath)){
			const sha256 = await createSha256(lxcZipPath);

			const lxcChecksum = fs.readFileSync(lxcZipChecksumPath, 'utf-8');

			if (sha256 === lxcChecksum.toString()){
				await unpackTgz(lxcZipPath, path.join(lxcCacheDir, "lxc") );
				return lxcFilePath;
			}

			fs.unlink(lxcZipPath, (err) => {
				if (err) {
				  console.error(err);
				}
			});
			fs.unlink(lxcZipChecksumPath, (err) => {
				if (err) {
				  console.error(err);
				}
			});
		}

		const lxcDownloadUrl = lxcUrl.concat(lxcName).concat(".tgz");

		const lxcDownloadChecksumUrl = lxcDownloadUrl.concat(".checksum");

		const lxcDowanloadPath = await downloadFile(lxcDownloadUrl, Constants.IDE_VSCODE_PLUGIN_CACHE_DIR, lxcName.concat(".tgz"));

		const lxcDowanloadChecksumPath = await downloadFile(lxcDownloadUrl.concat(".checksum"), Constants.IDE_VSCODE_PLUGIN_CACHE_DIR, lxcName.concat(".checksum"));

		if (fs.existsSync(lxcDowanloadChecksumPath) && fs.existsSync(lxcDowanloadPath)){
			const sha256 = await createSha256(lxcDowanloadPath);
			
			const lxcChecksum = fs.readFileSync(lxcDowanloadChecksumPath, 'utf-8');

			if (sha256 === lxcChecksum.toString()){
				await unpackTgz(lxcDowanloadPath, path.join(lxcCacheDir, "lxc") );
				return lxcFilePath;
			}

			throw new Error("Failed to verify check sum lxc.");
		}

		throw new Error("Failed to download lxc.");
	}

	async function getAvailableClientExtensinTypes(): Promise<QuickPickItem[]> {
		const clientExtensionApiJarVersion = await getWorkspaceClientExtensinApiJarVersion();

		const clientExtensionApiJarDownloaUrl = Constants.BASE_RELEASE_URL + "/content/com/liferay/com.liferay.client.extension.type.api/" + clientExtensionApiJarVersion +
			"/com.liferay.client.extension.type.api-" + clientExtensionApiJarVersion + ".jar";

		const clientExtensionApiJarPath = await downloadFile(clientExtensionApiJarDownloaUrl, Constants.IDE_VSCODE_PLUGIN_RELEASE_BOM_CACHE_DIR, "com.liferay.client.extension.type.api-" + clientExtensionApiJarVersion + ".jar");

		const clientExtensionTypes = await getJarClassNames(clientExtensionApiJarPath, "com/liferay/client/extension/type");

		return clientExtensionTypes.filter(item => item.length >1).map(label => ({ label }));
	}

	async function getWorkspaceClientExtensinApiJarVersion(): Promise<string> {
		const workspacePath = getCurrentWorkspacePath();

		if (!workspacePath){
			window.showInformationMessage(`${workspacePath} workspae project is invalid.`);
			throw new Error(`${workspacePath} workspae project is invalid.`);
		}

		const productKey = getWorkspaceProduct();

		if (!productKey){
			window.showInformationMessage(`${workspacePath} workspae project is not set product key.`);
			throw new Error(`${workspacePath} workspae project is not set product key.`);
		}

		const productInfos = await getProductInfos();

		const productInfo = productInfos.get(productKey);

		const targetPlatformVersion = productInfo?.targetPlatformVersion;

		const firstDashIndex = productKey.indexOf("-");

		const productType = productKey.substring(0, firstDashIndex);

		const releaseBomFileUrl = Constants.BASE_BOM_URL + "release." + productType + ".bom/" + targetPlatformVersion + "/release." + productType + ".bom-" + targetPlatformVersion + ".pom";

        const releaseBomPath = await downloadFile(releaseBomFileUrl, Constants.IDE_VSCODE_PLUGIN_RELEASE_BOM_CACHE_DIR, "release." + productType + ".bom-" + targetPlatformVersion + ".pom");

		return findTagsWithCssSelector(releaseBomPath, "com.liferay.client.extension.type.api");
	}

	function listZipEntries(zipFilePath: string): Promise<string[]> {
		return new Promise((resolve, reject) => {
		  const entries: string[] = [];
	  
		  yauzl.open(zipFilePath, { lazyEntries: true }, (err, zipfile) => {
			if (err) {reject(err);}
	  
			zipfile.readEntry();
	  
			zipfile.on('entry', (entry) => {
				entries.push(entry.fileName);
				zipfile.readEntry();
			});
	  
			zipfile.on('end', () => {
			  resolve(entries);
			});
		  });
		});
	}
	  

	function getJarClassNames(jarPath: string, directory: string): Promise<string[]> {
		return new Promise((resolve, reject) => {
		  let command = '';
		  if (os.platform() === 'win32') {
			command = `jar tf ${jarPath.replace(/\//g, '/')} | findstr /i ""${directory}" | findstr /i "\.class$"`;
		  } else {
			command = `jar tf ${jarPath} | grep -i "${directory}" | grep -i "\.class$"`;
		  }
		  exec(command, (error, stdout, stderr) => {
			if (error) {
			  reject(error);
			} else if (stderr) {
			  reject(new Error(stderr.trim()));
			} else {
				const classNames = stdout.trim().split(os.EOL)
				.filter(name => {
					const index = name.lastIndexOf('/');
					const packageName = name.substring(0,index);
					if (packageName === directory){
						return true;
					}
					return false;
				})
				.filter(name => name.indexOf('.class')>0)
				.map(name => name.replace(directory, ''))
				.map(name => name.replace('/', ''))
				.filter(name => !(name === 'CET'))
				.map(name => name.replace('CET', ''))
				.map(name => name.replace('.class', ''));
			  resolve(classNames);
			}
		  });
		});
	  }

	function shouldResume() {
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

	async function unpackZip(zipPath: string, output: string){
		if (!fs.existsSync(output)) {
			fs.mkdirSync(output, { recursive: true });
		}

		fs.createReadStream(zipPath)
		.pipe(
			unzipper.Parse()
		).on('entry', (entry) => {
		  const entryPath = entry.path;
		  const targetPath = path.join(output, entryPath);

		  if (entry.type === 'Directory') {
			fs.mkdirSync(targetPath, { recursive: true });
		  } else {
			entry.pipe(fs.createWriteStream(targetPath));
		  }
		}).on('error', (error) => {
		  	console.error(`An error occurred while unzipping the file: ${error}`);
		}).on('finish', () => {
		  	console.log('Unzip completed successfully!');
		});
	}

	function copyDir(srcPath: string, destPath: string) {
		if (!fs.existsSync(destPath)) {
		  fs.mkdirSync(destPath, { recursive: true });
		}
	  
		const entries = fs.readdirSync(srcPath, { withFileTypes: true });
	  
		entries.forEach(entry => {
		  const srcFullPath = path.join(srcPath, entry.name);
		  const destFullPath = path.join(destPath, entry.name);
	  
		  if (entry.isDirectory()) {
			copyDir(srcFullPath, destFullPath);
		  } else {
			fs.copyFileSync(srcFullPath, destFullPath);
		  }
		});
	  }

	async function lxcCreateClientExtensionProject(): Promise<void> {

		const workspacePath = getCurrentWorkspacePath();
	
		if (workspacePath){
			if (state.extensionType){

				const configManager = new LiferayConfigManager();
				const logger = configManager.getLogger();

				const lxcPath = await getLxc();

				let extensionType = state.extensionType as QuickPickItem;

				const clientExtensionApiJarVersion = await getWorkspaceClientExtensinApiJarVersion();

				const clientExtensionApiJarDownloaUrl = Constants.BASE_RELEASE_URL + "/content/com/liferay/com.liferay.client.extension.type.api/" + clientExtensionApiJarVersion +
					"/com.liferay.client.extension.type.api-" + clientExtensionApiJarVersion + ".jar";

				const extensionTypeString = extensionType.label;
				const commandExtensionType = extensionTypeString.charAt(0).toLowerCase() + extensionTypeString.slice(1);

				const options: SpawnSyncOptionsWithStringEncoding = {
					encoding: 'utf-8',
					cwd: workspacePath,
					env: { EXTENSION_METADATA_FILE: clientExtensionApiJarDownloaUrl },
					stdio: 'pipe'
					};

				const lxcExePath = `${lxcPath.replace(/\\/g, '/')}`;
					
				const result = spawnSync(lxcExePath, ['generate', '-i', state.name, '-n', state.extensionName, '-t', commandExtensionType, 'false'], options);
					
				if (result.status !== 0) {
					logger.log(`Failed to create client extension project, return code is ${result.status}.`);
					throw new Error("Failed to create client extension project.");
				}
			}
			else if (state.sampleExtensionType){
				const sampleClientExtensionWorkspacePath = await downloadFile(Constants.sampleClientExtensionUrl, Constants.IDE_VSCODE_PLUGIN_CACHE_DIR, "com.sample.workspace.client.extension.zip");
				const clientExtensionCacheDir = path.join(os.homedir(), Constants.IDE_VSCODE_PLUGIN_CACHE_DIR);
				const sampleClientExtensionDir = path.join(clientExtensionCacheDir, "sample_client_extension");
				await unpackZip(sampleClientExtensionWorkspacePath, sampleClientExtensionDir);

				const clientExtensionDir = path.join(sampleClientExtensionDir, "client-extensions");

				let sampleExtensionType = state.sampleExtensionType as QuickPickItem;

				copyDir(path.join(clientExtensionDir,sampleExtensionType.label), path.join(workspacePath,sampleExtensionType.label));
			}

			refreshWorkspaceView();
			window.showInformationMessage(`Creating Client Extension Project ${state.name}`);
		}
	}

	
	const state = await initLiferayClientExtension();

	lxcCreateClientExtensionProject();
}
