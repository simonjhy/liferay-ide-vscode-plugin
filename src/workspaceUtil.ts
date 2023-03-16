import path = require("path");
import * as fs from 'fs';


export function isLiferayGradleWorkspace(workspacePath :string): boolean{
	const regex = /.*apply.*plugin.*:.*[\'\"]com\.liferay\.workspace[\'\"].*/ms;

	if (workspacePath){
		const settingsGradlePath = path.join(workspacePath,"settings.gradle");
		const gradlePropertiesPath = path.join(workspacePath,"gradle.properties");

		if (!(fs.existsSync(settingsGradlePath) || fs.existsSync(gradlePropertiesPath))){
			return false;
		}

		const data = fs.readFileSync(settingsGradlePath, 'utf8');

		if (regex.test(data)){
			return true;
		}

		return false;
	}

	return false;
  }
