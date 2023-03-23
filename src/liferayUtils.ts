'use strict';

import * as fs from 'fs';
import { PathLike } from 'fs';
import * as path from 'path';
import { workspace, WorkspaceConfiguration } from 'vscode';
import { promisify } from 'util';
import { exec, spawnSync } from 'child_process';
import fetch, { Response } from 'node-fetch';
import * as vscode from 'vscode';
import * as os from 'os';
import { findJavaHomes, JavaRuntime } from './java-runtime/findJavaHomes';
import Constants from './constants';
import * as crypto from 'crypto';
import { Hash } from 'crypto';
import * as util from "util";
import { ExtensionApi as GradleApi, RunTaskOpts, Output } from "vscode-gradle";
import { DOMParser } from 'xmldom';
import * as xmlQuery from 'xml-query';
import { XmlNode } from 'xml-query';
import * as https from 'https';
import axios from 'axios';



	// function findParentElements(json: any, selector: string): any[] {
	// 	// 使用 jsonpath.query 方法查找所有符合条件的元素
	// 	const elements = jsonpath.query(json, selector);

	// 	// 返回所有符合条件的元素的父元素
	// 	return elements.map((element: any) => {
	// 		return element.parent;
	// 	});
	// }

	export function findTagsWithCssSelector(filePath: string, tagId: string): any {
		const xmlString = fs.readFileSync(filePath, 'utf8');

		// 将XML字符串解析为DOM对象
		const parser = new DOMParser();
		const xmlDoc = parser.parseFromString(xmlString, "application/xml");

		const dependencys = xmlDoc.getElementsByTagName('dependency');

		// 遍历查询结果并输出每本书的信息
		for (let i = 0; i < dependencys.length; i++) {
			const dependency = dependencys.item(i);

			if(!dependency){
				continue;
			}

			const artifcatId = dependency.getElementsByTagName("artifactId")[0].textContent;;
			if (artifcatId === tagId) {
				return dependency.getElementsByTagName("version")[0].textContent;
			}
		}
  	}

	export function getJavaConfiguration(): WorkspaceConfiguration {
		return workspace.getConfiguration('java');
	}

	export function getLiferayConfiguration(): WorkspaceConfiguration {
		return workspace.getConfiguration('liferay');
	}

	export interface ProductInfo{

		appServerTomcatVersion: string;
		bundleUrl: string;
		liferayDockerImage: string;
		liferayProductVersion: string;
		promoted: boolean;
		releaseDate: Date;
		bundleChecksumMD5: string;
		bundleChecksumMD5Url: string;
		targetPlatformVersion: string;

	}

	export function deleteDirectory(dir : PathLike) {
		if (fs.existsSync(dir)) {
			fs.readdirSync(dir).forEach((child) => {
				const entry = path.join(dir.toLocaleString(), child);
				if (fs.lstatSync(entry).isDirectory()) {
					deleteDirectory(entry);
				} else {
					fs.unlinkSync(entry);
				}
			});
			fs.rmdirSync(dir);
		}
	}

	export function getTimestamp(file: PathLike) {
		if (!fs.existsSync(file)) {
			return -1;
		}
		const stat = fs.statSync(file);
		return stat.mtimeMs;
	}

	export function ensureExists(folder: PathLike) {
		if (fs.existsSync(folder)) {
			return;
		}
		ensureExists(path.dirname(folder.toLocaleString()));
		fs.mkdirSync(folder);
	}

	export async function callJarFileAsync(): Promise<void> {
		const execAsync = promisify(exec);

		const args = ['arg1', 'arg2', 'arg3'];
		try {
		const { stdout, stderr } = await execAsync(`java -jar myjarfile.jar ${args.join(' ')}`);
		console.log('stdout:', stdout);
		console.error('stderr:', stderr);
		} catch (err) {
		console.error(err);
		}
	}

	async function getFileLastModifiedTime(fileUrl: string): Promise<Date> {
		const response = await axios.head(fileUrl, { maxRedirects: 5 });
		if (response.status === 200) {
		  const lastModifiedTimeStr = response.headers['last-modified'];
		  if (lastModifiedTimeStr) {
			return new Date(lastModifiedTimeStr);
		  } else {
			throw new Error(`Failed to get last modified time from ${fileUrl}`);
		  }
		} else if (response.status === 302 && response.headers.location) {
		  // Follow redirect
		  return getFileLastModifiedTime(response.headers.location);
		} else {
		  throw new Error(`Failed to get file info from ${fileUrl}`);
		}
	  }


	  export async function downloadFile(url: string, cacheDirName: string, fileName: string): Promise<string> {
		const cacheDir = path.join(os.homedir(), cacheDirName);
		const cacheDirExists = fs.existsSync(cacheDir);
	  
		if (!cacheDirExists) {
		  fs.mkdir(cacheDir, { recursive: true }, (err) => {
			if (err) {
			  throw new Error(`Failed to create blade cache directory ${cacheDir}.`);
			}
			console.log(`Directory ${cacheDir} created successfully`);
		  });
		}
	  
		const savePath = path.join(cacheDir, fileName);
	  
		// Check if the file already exists
		const fileExists = fs.existsSync(savePath);
		if (fileExists) {
		  const stats = fs.statSync(savePath);
		  const fileModifiedTime = stats.mtimeMs;
		  const remoteModifiedTime = new Date(await getFileLastModifiedTime(url)).getTime();
		  if (remoteModifiedTime <= fileModifiedTime) {
			return savePath;
		  }
		}
	  
		const response = await axios.get(url, { responseType: 'stream' });
		if (response.status !== 200) {
		  throw new Error(`Failed to download file from ${url}.`);
		}
	  
		const lastModifiedDate = response.headers['last-modified'];
	  
		let remoteModifiedTime = new Date();
		if (lastModifiedDate) {
		  remoteModifiedTime = new Date(lastModifiedDate);
		}
	  
		const fileStream = fs.createWriteStream(savePath);
	  
		response.data.pipe(fileStream);
	  
		return new Promise<string>((resolve, reject) => {
		  fileStream.on('finish', () => {
			fs.utimes(savePath, new Date(), remoteModifiedTime, (err) => {
			  if (err) {
				console.error(`Failed to modify file time: ${err}`);
			  }
			});
			resolve(savePath);
		  });
		  fileStream.on('error', reject);
		});
	  }
	

	export function getJavaExecutable(javaHome: JavaRuntime): string{
		if (process.platform === 'win32') {
			return path.join(javaHome.home, '/bin/java.exe');
		} else if ((process.platform === 'darwin') || (process.platform === 'linux')) {
			return path.join(javaHome.home, '/bin/java');
		}

		return 'underfined';
	}

	function openWorkspaceFolder(workspacePath: string){
		const uri = vscode.Uri.file(workspacePath);
		const workspaceFolder = vscode.workspace.updateWorkspaceFolders(0, 0, { uri });
		vscode.workspace.getWorkspaceFolder(uri);
		vscode.commands.executeCommand('vscode.openFolder', uri, false);
	}

	export async function openCurrentLiferayWorkspaceProject(workspacePath: string): Promise<void> {
		const folderUri = vscode.Uri.file(workspacePath);
	
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) {
		openWorkspaceFolder(workspacePath);
		} else {
			const confirmResult = await vscode.window.showWarningMessage(`Do you want to close current workspace folder and open ${folderUri} as a new workspace folder?`, 'Yes', 'No');
			if (confirmResult === 'Yes') {
				let currentWorkspaceFolders = vscode.workspace.workspaceFolders;

				if (currentWorkspaceFolders === undefined ){
					return;
				}
				else{
					const currentWorkspaceFolder = currentWorkspaceFolders[0];
					vscode.workspace.updateWorkspaceFolders(currentWorkspaceFolder.index, 1,);
					vscode.commands.executeCommand('workbench.action.closeFolder');
				}
			} else {
				return;
			}

			openWorkspaceFolder(workspacePath);
		}
	}


	export async function addFolderToWorkspace(folderPath: string): Promise<void> {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (workspaceFolders) {
			const folderUri = vscode.Uri.file(folderPath);
			vscode.workspace.updateWorkspaceFolders(workspaceFolders.length, 0, { uri: folderUri });
		}
	}

	export async function refreshWorkspaceView(): Promise<void> {
		vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer');
	}


	export function findDirectoriesContaining(dir: string, filterDir: string): string[] {
		let results: string[] = [];
	
		const files = fs.readdirSync(dir);
	
		files.forEach((file) => {
		const filePath = path.join(dir, file);
		const stat = fs.statSync(filePath);
	
		if (stat.isDirectory()) {
			const dirName = path.basename(filePath);
			if (dirName.includes(filterDir)) {
			results.push(filePath);
			} else {
			results = results.concat(findDirectoriesContaining(filePath,filterDir ));
			}
		}
		});
	
		return results;
	}
	

	export interface WorkspaceFolderMatch {
		folder: vscode.WorkspaceFolder;
		match: boolean;
	}
  
	export function findMatchingWorkspaceFolder(pattern: string): WorkspaceFolderMatch | undefined {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) {
		return undefined;
		}
		for (const folder of workspaceFolders) {
		const folderPath = folder.uri.fsPath;
		const folderName = folderPath.slice(folderPath.lastIndexOf('/') + 1);
		if (folderName === pattern) {
			return { folder, match: true };
		}
		}
		return { folder: workspaceFolders[0], match: false };
	}

	export function getCurrentWorkspacePath(): string | undefined {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders || workspaceFolders.length === 0) {
			return undefined;
		}
		const workspaceFolder = workspaceFolders[0];
		return workspaceFolder.uri.fsPath;
	}

	export async function getProductInfos(): Promise<Map<string, ProductInfo>> {
		const productInfoPath = await downloadFile(Constants.PRODUCT_INFO_DOWNLOAD_URL, Constants.PRODUCT_INFO_CACHE_DIR, Constants.PRODUCT_INFO_NAME);

		const jsonString = fs.readFileSync(productInfoPath, 'utf-8');

		const productInfoMap = new Map<string, ProductInfo>();

		const jsonObject = JSON.parse(jsonString);

		for (const key in jsonObject) {
			if (Object.prototype.hasOwnProperty.call(jsonObject, key)) {
				const productInfo = jsonObject[key] as ProductInfo;
				productInfoMap.set(key, productInfo);
			}
		}

		return productInfoMap;
	}

	export async function getBladeJar(): Promise<string> {
		return downloadFile(Constants.BLADE_DOWNLOAD_URL, Constants.BLADE_CACHE_DIR, Constants.BALDE_JAR_NAME);
	}

