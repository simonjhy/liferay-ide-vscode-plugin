'use strict';

/**
 * Commonly used commands
 */
namespace Constants {
    export const NEW_LIFERAY_WORKSAPCE = 'new.liferay.workspace';

    export const NEW_LIFERAY_CLIENT_EXTENSION = 'new.liferay.client.extension';

    export const NEW_LIFERAY_MODULE = 'new.liferay.module';
     
    export const NEW_LIFERAY_SPRING_MODULE = 'new.liferay.spring.module';

    export const NEW_LIFERAY_JSF_MODULE = 'new.liferay.jsf.module';

    export const NEW_LIFERAY_FRAGMENT_MODULE = 'new.liferay.fragment.module';

    export const GET_ALL_JAVA_PROJECTS = 'java.project.getAll';

    export const EXECUTE_WORKSPACE_COMMAND = 'java.execute.workspaceCommand';

    export const REQUIRED_JDK_VERSION = 11;

    export const BLADE_DOWNLOAD_URL = 'https://repository-cdn.liferay.com/nexus/content/repositories/liferay-public-snapshots/com/liferay/blade/com.liferay.blade.cli/4.1.2-SNAPSHOT/com.liferay.blade.cli-4.1.2-20230307.022352-12.jar';

    export const BLADE_CACHE_DIR = '.liferay/blade'; 

    export const PRODUCT_INFO_CACHE_DIR = '.liferay/workspace'; 

    export const PRODUCT_INFO_NAME = '.product_info.json'; 

    export const BALDE_JAR_NAME = 'blade.jar'; 

    export const PRODUCT_INFO_DOWNLOAD_URL = 'https://releases.liferay.com/tools/workspace/.product_info.json';

    export const LXC_DOWNLOAD_URL = 'https://github.com/ipeychev/lxc-cli-release/releases/download/0.0.6/';
	
    export const GRADLE_PROPERTIES_FILE_NAME = "gradle.properties";

	export const SETTINGS_GRADLE_FILE_NAME = "settings.gradle";

    export const LIFERAY_WORKSPACE_PRODUCT = "liferay.workspace.product";

    export const BASE_BOM_URL = "https://repository.liferay.com/nexus/content/groups/public/com/liferay/portal/";

    export const IDE_VSCODE_PLUGIN_CACHE_DIR = '.liferay/vscode-plugin'; 

    export const BASE_RELEASE_URL = "https://repository-cdn.liferay.com/nexus/service/local/repositories/liferay-public-releases";

    export const sampleClientExtensionUrl = "https://repository.liferay.com/nexus/service/local/artifact/maven/content?r=liferay-public-releases&g=com.liferay.workspace&a=com.sample.workspace&v=LATEST&p=zip";
}

export default Constants;
