import { bgBlue, red, green, blue, bold, italic } from "https://deno.land/std@0.51.0/fmt/mod.ts";
import Spinner from 'https://raw.githubusercontent.com/ameerthehacker/cli-spinners/master/mod.ts';
import { exists, debug, message, d2 } from './_utils.ts';
import { command } from './_command.ts';
import vars from './../vars.ts';

const { HOME, PIDS_DIR, APPS_DIR } = vars;

export class Api {
	constructor() {
		// initialize
		this.init().then(() => {
			// handle args
			command(this, Deno.args);
		});
	}

	private async storeInfo(data: {[key: string]: any}) {
		await Deno.writeTextFile(APPS_DIR + '/' + data.daemonName, JSON.stringify(data));
	}

	private async getAllInfo(pluck: string[] = []) {
		const output: object[] = [];
		for await (const dirEntry of Deno.readDir(APPS_DIR)) {
			if(dirEntry.name.toLowerCase() !== '.ds_store')
				output.push(await this.getInfo(dirEntry.name, pluck));
		}

		return output;
	}

	private async getInfo(daemonName: string, pluck: string[] = []): Promise<object> {
		const path = APPS_DIR + '/' + daemonName;
		const file = await Deno.readFile(path);
		const text = new TextDecoder().decode(file);
		let json = JSON.parse(text);

		if(pluck.length) {
			const plucking: {[key: string]: any} = {};
			Object.keys(json).forEach(key => {
				if(pluck.includes(key)) {
					plucking[key] = json[key];
				}
			});

			json = plucking;
		}

		return json;
	}

	private async updateInfo(daemonName: string, data: {[key: string]: any}): Promise<void> {
		const json = await this.getInfo(daemonName);

		const updated = {
			...json,
			...data
		}

		this.storeInfo(updated);
	}

	private async mkdirApps(): Promise<void> {
		const path = APPS_DIR;

		const check = await exists(path);

		if(!check) {
			await Deno.mkdir(path);
		}
	}

	async init(): Promise<boolean> {
		return new Promise(resolve => {
			exists(HOME).then(() => {
				debug(green(`The ${HOME} directory was found`));

				this.mkdirApps();

				return resolve(true);
			})
			.catch(async () => {
				debug(`Creating ${HOME} directory`);
				await Deno.mkdir(HOME);

				return resolve(true);
			});	
		});
	}

	private async writePid(name: string, pid: string): Promise<void> {
		const path = PIDS_DIR + '/' + name;

		await Deno.create(path);

		const encoder = new TextEncoder();
		const pidFile = await Deno.open(path, { read: true, write: true });
		
		await Deno.write(pidFile.rid, encoder.encode(pid));
	}

	private checkDaemon(daemonName: string): Promise<Boolean> {
		return exists(PIDS_DIR + '/' + daemonName);
	}

	private getPidByName(daemonName: string): Promise<string | object> {
		const path = PIDS_DIR + '/' + daemonName;

		return new Promise((resolve, reject) => {
			exists(path)
			.then(async () => {
				const content = await Deno.readFile(path);
				const text = new TextDecoder().decode(content);

				return resolve(text);
			})
			.catch(error => {
				if(error instanceof Deno.errors.NotFound)
					return reject({
						error: true,
						notFound: true
					});

				return reject(error);
			});
		});
	}

	private checkPidProcess(pid: string): Promise<string | object> {
		return new Promise((resolve, reject) => {
			const ps = Deno.run({
				cmd: ['ps', '-p', pid],
				stdout: 'null',
				stdin: 'null',
				stderr: 'null'
			});

			ps.status()
			.then((res) => {
				if(res.success) {
					return resolve(pid.toString());
				}else{
					return reject({
						error: true,
						notRunnig: true
					});
				}
			})
			.catch((err) => {
				return reject(err);
			});
		});
	}

	private async checkPid(daemonName: string): Promise<string | boolean | object> {
		const pid = await this.getPidByName(daemonName);

		if(pid) {
			return await this.checkPidProcess(pid.toString());
		}else{
			return false;
		}
	}

	private async runSubprocess(targetFile: string, daemonName: string): Promise<void> {
		message('Starting daemon');

		const args = Deno.args;
		const env = Deno.env.toObject();
		const ourArgs = ['--debug'];
		const processArgs = [...args];

		// soon!!!!
		// const options = (processArgs)
		// 	.slice(3, processArgs.length)
		// 	.filter(item => !ourArgs.includes(item) ? item : false);

		// for now
		const options = ['-A'];


		const daemon: Deno.Process = Deno.run({
			cmd: [Deno.execPath(), "run", ...options, './' + targetFile, ...args],
			env,
			stdin: 'null',
			stdout: 'piped',
			stderr: 'piped'
		});

		debug('Writing PID');

		const data = {
			daemonName,
			targetFile,
			path: Deno.env.get('PWD'),
			options,
			execPath: Deno.execPath(),
			startedAt: new Date().toString(),
			stoppedAt: null,
			startedBy: Deno.env.get('USER'),
			stoppedBy: null,
			status: 'running',
			pid: daemon.pid,
		}

		this.writePid(daemonName, daemon.pid.toString())
		.then(() => {
			this.storeInfo(data).then(() => {
				message(green(`Daemon started successfully`));
				Deno.exit();
			})
		});
	}

	private async createPid(targetFile: string, daemonName: string) {
		debug(`Creating a new daemon with alias name ${daemonName}`);

		const check = await this.checkDaemon(daemonName);

		if(check) {
			message(bgBlue(`A daemon with name ${daemonName} is exist.`));

			this.checkPid(daemonName).then(() => {
				// if the daemon's PID file exists and the process also running

				message('Daemon status: ' + green('running'));
				message(`Run the ` + blue(`\`stop ${daemonName}\``) + ` command to stop the daemon`);
			})
			.catch(() => {
				// if daemon's PID file is exists, but the process was stopped

				message('Daemon status: ' + red('stopped'));
				message(blue('Restarting daemon'));
				this.runSubprocess(targetFile, daemonName);
			});
		}else{
			// if the daemon's PID file not exist and the process also stopped

			this.runSubprocess(targetFile, daemonName);
		}
	}

	private async startDaemon(targetFile: string, aliasName?: string): Promise<void> {
		const daemonName = aliasName ?? targetFile.replace(/\./g, '_');

		const check = await exists(PIDS_DIR);

		if(check) {
			return await this.createPid(targetFile, daemonName);
		}else{
			debug(`The ${PIDS_DIR} directory couldn't be found.`);
			debug(`Creating ${PIDS_DIR} directory.`);

			return await Deno.mkdir(PIDS_DIR);
		}
	}

	async start(aliasName: string, targetFile: string = '') {
		const path = APPS_DIR + '/' + aliasName;
		const app = await exists(path);
		let execFile: string = targetFile;

		// if app exists
		if(app) {
			debug('Get the `targetFile` from exisiting app file');
			const appInfo: {[key: string]: any} = await this.getInfo(aliasName);

			execFile = appInfo.targetFile;
		}

		if(!aliasName) return message(red('Please provide the alias name.'));
		if(!execFile) return message(red('Please provide the target file.'));

		// check if the `targetFile` is exists
		exists(execFile)
		.then(() => {
			debug(`The ${execFile} file was found.`);

			this.startDaemon(execFile, aliasName);
		})
		.catch(err => {
			debug(`The ${execFile} couldn't be found.`);
		});
	}

	private async deletePid(daemonName: string): Promise<void> {
		await Deno.remove(PIDS_DIR + '/' + daemonName);
	}

	private stopSubprocess(daemonName: string, pid: string): void {
		debug('Stopping the daemon');

		const process: Deno.Process = Deno.run({
			cmd: ['kill', pid],
			stdout: 'null',
			stdin: 'null',
			stderr: 'null'
		});

		debug('Killing the PID');
		process.status()
		.then(res => {
			if(res.success) {
				this.deletePid(daemonName)
				.then(() => {
					this.updateInfo(daemonName, {
						status: 'stopped',
						stoppedBy: Deno.env.get('USER'),
						stoppedAt: new Date().toString()
					}).then(() => {
						debug(green('Daemon stopped successfully'));
					});
				});
			}
		})
		.catch(() => {

		});
	}

	private async restart(daemonName: string) {
		message('Restarting daemon');

		// this.stopDaemon(daemonName).then(res => this.start(daemonName))
		// 	.catch(err => debug(err));

		// debug(stop);
		// this.start(daemonName);
	}

	private async stopDaemon(daemonName: string): Promise<boolean | void> {
		debug('Checking daemon name');

		this.checkPid(daemonName).then(pid => {
			return this.stopSubprocess(daemonName, pid.toString());
		})
		.catch(err => {
			if(err.notFound || err.notRunnig) {
				debug(red(`Daemon with name ${daemonName} is already stopped`))
			}
			else {
				debug(err);
			}
		});
	}

	async stop(aliasName: string): Promise<void> {
		if(!aliasName) return debug('Please provide the daemon name');

		await this.stopDaemon(aliasName);
	}

	private tableDateFormat(string: string): string {
		let format: string;

		const d = new Date(string);

		format = `${d2(d.getDate())}-${d2(d.getMonth())}-${d2(d.getFullYear())} ${d2(d.getHours())}:${d2(d.getMinutes())}:${d2(d.getSeconds())}`;

		return format;
	}

	private listTable(data: any) {
		const newArr: object[] = [];

		data.forEach((item: {[key: string]: any}) => {
			const refact: {[key: string]: any} = {};

			refact['Daemon Name'] = item.daemonName;
			refact['Path'] = item.path;
			refact['Status'] = item.status == 'running' ? 'Running' : 'Stopped';
			refact['Started At'] = this.tableDateFormat(item.startedAt);

			newArr.push(refact);
		});

		console.table(newArr, ['Daemon Name', 'Path', 'Status', 'Started At']);
	}

	async list() {
		const spinner = Spinner.getInstance();

		await spinner.start('Getting list');

		const columns: string[] = ['daemonName', 'status', 'path', 'startedAt'];
		const info = await this.getAllInfo(columns);

		await spinner.succeed('Showing all applications');

		this.listTable(info);
	}

	async show(daemonName: string) {
		const spinner = Spinner.getInstance();

		await spinner.start('Getting details');

		const info: {[key: string]: any} = await this.getInfo(daemonName);

		await spinner.succeed(`Showing the ${daemonName} details`)

		const refact = {
			"Daemon Name": info.daemonName,
			"Status": info.status,
			"Uptime": info.startedAt,
			"Working Directory": info.path,
			"Script Path": info.execPath,
			"Exec File": info.targetFile,
			"Arguments": info.options.join(','),
			"Started By": info.startedBy,
			"PID": info.pid,
			"Stopped At": info.stoppedAt ?? '(None)',
			"Stopped By": info.stoppedBy ?? '(None)',
		}

		console.table(refact);

		console.log(
			italic(
				blue(` \nPossible commands:\n${ info.status == 'stopped' ? `- Run \`denod start ${daemonName}\`\n` : ''} ${ info.status == 'running' ? `- Run \`denod reload ${daemonName}\`\n` : ''} ${ info.status == 'running' ? `- Run \`denod stop ${daemonName}\`\n` : ''}`.trim())
			)
		);
	}
}