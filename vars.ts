import { getHomeDir } from './apis/_utils.ts';

const HOME = getHomeDir();

const vars = {
	HOME,
	PIDS_DIR: HOME + '/pids',
	APPS_DIR: HOME + '/apps'
}

export default vars;