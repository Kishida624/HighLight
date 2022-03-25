import { useErrorWebhook } from '#hooks/useErrorWebhook';
import { withDeprecationWarningForMessageCommands } from '#hooks/withDeprecationWarningForMessageCommands';
import { createErrorEmbed } from '#utils/embeds';
import { bold, codeBlock, inlineCode } from '@discordjs/builders';
import { ApplyOptions } from '@sapphire/decorators';
import {
	Awaitable,
	ChatInputCommandErrorPayload,
	container,
	ContextMenuCommandErrorPayload,
	Events,
	Listener,
	MessageCommandErrorPayload,
	Piece,
	UserError,
} from '@sapphire/framework';
import { MessageActionRow, MessageButton, MessageOptions } from 'discord.js';
import { randomUUID } from 'node:crypto';

@ApplyOptions<Listener.Options>({
	name: 'MessageCommandError',
	event: Events.MessageCommandError,
})
export class MessageCommandError extends Listener<typeof Events.MessageCommandError> {
	public override async run(error: unknown, { message, command }: MessageCommandErrorPayload) {
		const maybeError = error as Error;

		await makeAndSendErrorEmbed(
			maybeError,
			(options) =>
				message.channel.send(
					withDeprecationWarningForMessageCommands({
						commandName: command.name,
						guildId: message.guildId,
						receivedFromMessage: true,
						options,
					}),
				),
			command,
		);
	}
}

@ApplyOptions<Listener.Options>({
	name: 'ChatInputCommandError',
	event: Events.ChatInputCommandError,
})
export class ChatInputCommandError extends Listener<typeof Events.ChatInputCommandError> {
	public override async run(error: unknown, { interaction, command }: ChatInputCommandErrorPayload) {
		const maybeError = error as Error;

		await makeAndSendErrorEmbed(
			maybeError,
			(options) => {
				if (interaction.replied) {
					return interaction.followUp({
						...options,
						ephemeral: true,
					});
				} else if (interaction.deferred) {
					return interaction.editReply(options);
				}

				return interaction.reply({
					...options,
					ephemeral: true,
				});
			},
			command,
		);
	}
}

@ApplyOptions<Listener.Options>({
	name: 'ContextMenuCommandError',
	event: Events.ContextMenuCommandError,
})
export class ContextMenuCommandError extends Listener<typeof Events.ContextMenuCommandError> {
	public override async run(error: unknown, { interaction, command }: ContextMenuCommandErrorPayload) {
		const maybeError = error as Error;

		await makeAndSendErrorEmbed(
			maybeError,
			(options) => {
				if (interaction.replied) {
					return interaction.followUp({
						...options,
						ephemeral: true,
					});
				} else if (interaction.deferred) {
					return interaction.editReply(options);
				}

				return interaction.reply({
					...options,
					ephemeral: true,
				});
			},
			command,
		);
	}
}

async function makeAndSendErrorEmbed(
	error: Error | UserError,
	callback: (options: MessageOptions) => Awaitable<unknown>,
	piece: Piece,
) {
	if (error instanceof UserError) {
		const errorEmbed = createErrorEmbed(error.message);

		await callback({
			embeds: [errorEmbed],
			allowedMentions: { parse: [] },
		});

		return;
	}

	const webhook = useErrorWebhook();
	const { name, location } = piece;
	container.logger.error(`Encountered error on command ${name} at path ${location.full}`, error);
	const errorUuid = randomUUID();

	await webhook.send({
		content: `Encountered an unexpected error, take a look @here!\nUUID: ${bold(inlineCode(errorUuid))}`,
		embeds: [
			createErrorEmbed(codeBlock('ansi', error.stack ?? error.message))
				.addField('Command', name)
				.addField('Path', location.full),
		],
		allowedMentions: { parse: ['everyone'] },
		avatarURL: container.client.user!.displayAvatarURL(),
		username: 'Error encountered',
	});

	const errorEmbed = createErrorEmbed(
		`Please send the following code to our [support server](${process.env.SUPPORT_SERVER_INVITE}): ${bold(
			inlineCode(errorUuid),
		)}\n\nYou can also mention the following error message: ${codeBlock('ansi', error.message)}`,
	).setTitle('An unexpected error occurred! 😱');

	await callback({
		components: [
			new MessageActionRow().setComponents([
				new MessageButton()
					.setStyle('LINK')
					.setURL(process.env.SUPPORT_SERVER_INVITE!)
					.setEmoji('🆘')
					.setLabel('Support server'),
			]),
		],
		embeds: [errorEmbed],
		allowedMentions: { parse: [] },
	});
}
