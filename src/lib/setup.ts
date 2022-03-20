// Sapphire config
import { container, ApplicationCommandRegistries, RegisterBehavior } from '@sapphire/framework';
import '@sapphire/plugin-logger/register';

ApplicationCommandRegistries.setDefaultBehaviorWhenNotIdentical(RegisterBehavior.Overwrite);

// NodeJS inspect settings
import { inspect } from 'node:util';
inspect.defaultOptions.depth = 2;

// Global color utility
import { createColors, Colorette } from 'colorette';
container.colors = createColors({ useColor: true });

declare module '@sapphire/pieces' {
	interface Container {
		colors: Colorette;
	}
}

// Prisma
import Prisma from '@prisma/client';
import { SqlHighlighter } from '@mikro-orm/sql-highlighter';

container.prisma = new Prisma.PrismaClient({
	errorFormat: 'pretty',
	log: [
		{ emit: 'stdout', level: 'warn' },
		{ emit: 'stdout', level: 'error' },
		{ emit: 'event', level: 'query' },
	],
});

const sqlHighlighter = new SqlHighlighter();

container.prisma.$on('query', (event) => {
	try {
		const paramsArray = JSON.parse(event.params) as unknown[];
		const newQuery = event.query.replace(/\$(\d+)/g, (_, number) => {
			const value = paramsArray[Number(number) - 1];
			if (typeof value === 'string') {
				return `"${value}"`;
			}

			return String(value);
		});

		container.logger.debug(`${container.colors.cyanBright('prisma:query')} ${sqlHighlighter.highlight(newQuery)}`);
	} catch {
		container.logger.debug(
			`${container.colors.cyanBright('prisma:query')} ${sqlHighlighter.highlight(
				`${event.query} PARAMETERS ${event.params}`,
			)}`,
		);
	}
});

container.prisma.$use(async (params, next) => {
	const before = Date.now();

	const result = await next(params);

	const after = Date.now();

	container.logger.debug(
		`${container.colors.cyanBright('prisma:query')} ${container.colors.bold(
			`${params.model}.${params.action}`,
		)} took ${container.colors.bold(`${container.colors.green(String(after - before))}ms`)}`,
	);

	return result;
});

declare module '@sapphire/pieces' {
	interface Container {
		prisma: Prisma.PrismaClient<{
			errorFormat: 'pretty';
			log: (
				| {
						emit: 'stdout';
						level: 'warn';
				  }
				| {
						emit: 'stdout';
						level: 'error';
				  }
				| {
						emit: 'event';
						level: 'query';
				  }
			)[];
		}>;
	}
}

// Highlight manager
import { HighlightManager } from '#structures/HighlightManager';

container.highlightManager = new HighlightManager();

declare module '@sapphire/pieces' {
	interface Container {
		highlightManager: HighlightManager;
	}
}