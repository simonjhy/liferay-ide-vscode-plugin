'use strict';

import * as fs from 'fs';
import { PathLike } from 'fs';
import * as path from 'path';
import { workspace, WorkspaceConfiguration } from 'vscode';
import { promisify } from 'util';
import { exec } from 'child_process';
import fetch, { Response } from 'node-fetch';
import * as vscode from 'vscode';
import * as os from 'os';
import Constants from './constants';

export function getJavaConfiguration(): WorkspaceConfiguration {
	return workspace.getConfiguration('java');
}

export function getLiferayConfiguration(): WorkspaceConfiguration {
	return workspace.getConfiguration('liferay');
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

const cacheDir = path.join(os.homedir(), Constants.BLADE_CACHE_DIR);
export async function downloadJarFile(url: string, fileName: string): Promise<string> {
	
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
	  // Check if the file needs to be updated
	  const response = await fetch(url);
	  if (!response.ok) {
		throw new Error(`Failed to download file from ${url}.`);
	  }
	  const remoteModifiedTime = new Date(response.headers.get('last-modified')!).getTime();
	  if (remoteModifiedTime <= fileModifiedTime) {
		return savePath;
	  }
	}
  
	const response = await fetch(url);
	if (!response.ok) {
	  throw new Error(`Failed to download file from ${url}.`);
	}
  
	const fileStream = fs.createWriteStream(savePath);

	if (response.body === undefined || response.body === null) {
		throw new Error('Response body is empty');
	}

	response.body.pipe(fileStream);
  
	return new Promise<string>((resolve, reject) => {
	  fileStream.on('finish', () => resolve(savePath));
	  fileStream.on('error', reject);
	});
  }
  
