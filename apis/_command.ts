import { debug } from './_utils.ts';

const commandList = [
	'start',
	'stop',
	'restart',
	'reload',
	'list',
	'show'
]

export function command(obj: {[key: string]: any}, args: string[]): void {
	const commandName: string = args[0];

	// check if the `commandName` is exists on the `obj` object
	if(commandList.includes(commandName)) {
		const aliasName: string = args[1];
		const targetFile: string = args[2];

		if(commandName === 'start') {
			obj.start(aliasName, targetFile);
		}
		else if(commandName === 'stop') {
			obj.stop(args[1]);
		}
		else if(commandName === 'list') {
			obj.list();
		}
		else if(commandName === 'show') {
			obj.show(args[1]);
		}
		else if(commandName == 'restart' || commandName == 'reload') {
			obj.restart(args[1]);
		}
	}else{
		debug(`Command ${commandName} not found.`);
	}
}