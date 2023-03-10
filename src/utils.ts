'use strict';

import * as fs from 'fs';
import { PathLike } from 'fs';
import * as path from 'path';
import { workspace, WorkspaceConfiguration } from 'vscode';
import { promisify } from 'util';
import { exec } from 'child_process';

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
