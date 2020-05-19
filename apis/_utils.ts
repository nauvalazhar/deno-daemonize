export async function exists(path: string) {
	try {
		await Deno.stat(path);
		// successful, file or directory must exist
		return true;
	} catch (error) {
		if (error instanceof Deno.errors.NotFound) {
			return false;
		} else {
			// unexpected error, maybe permissions, pass it along
			throw error;
		}
	}
};

export function getHomeDir(): string {
	return Deno.env.get('HOME') + '/.daemonize';
} 

export function d2(num: number|string): string {
	return num < 10 ? '0' + num : num.toString();
}

function timeNow() {
	const d = new Date();

	return [d2(d.getHours()), d2(d.getMinutes()), d2(d.getSeconds())].join(':');
}

export function isDebugOn(): boolean {
	const args: {
		[key: string]: any
	} = Deno.args;

	const isDebug = args.find((arg: string) => arg == '--debug');

	if(isDebug?.length > 0) return true;

	return false;
}

export function debug(...message: any): void {
	if(isDebugOn())
		return console.log(`[${timeNow()}] `, ...message);
}

export function message(message: any): void {
	return console.log(`[${timeNow()}] `, message);
}