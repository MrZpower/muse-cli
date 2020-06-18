import { MessageEmbed, TextChannel, VoiceChannel } from 'discord.js';
import { Music } from './Music';
import { Queue } from './Queue';
import { defaultQueue } from './DefaultQueue';
import ytdl from 'discord-ytdl-core';
import { client } from '../..';

interface QueueInfo {
    music: Music;
    textChannel: TextChannel;
    voiceChannel: VoiceChannel;
    playlist: boolean;
}

export class MusicPlayer {

    private readonly embed = new MessageEmbed()
        .setColor('RANDOM');

    public addToQueue({ music, textChannel, voiceChannel, playlist }: QueueInfo) {

        const queue = textChannel.guild.queue;

        queue.upcoming.push(music);

        if (typeof queue.current === 'undefined') {
            queue.current = queue.upcoming.shift();
        }

        if (typeof queue.voiceChannel === 'undefined') {
            queue.voiceChannel = voiceChannel;
        }

        if (typeof queue.textChannel === 'undefined') {
            queue.textChannel = textChannel;
        }

        if (!playlist && queue.upcoming.length > 0) {
            const addedVideoIndex = queue.upcoming.indexOf(music);
            const position = addedVideoIndex == 0 ? 'Up Next' : addedVideoIndex + 1;

            this.embed
                .setTitle("Added Video to Queue")
                .setDescription(`\`\`\`${music.title}\`\`\``)
                .setThumbnail(music.thumbnail)
                .addField("Position:", position, true)
                .addField("Requested By:", music.requester.user.tag, true)
                .setTimestamp();

            textChannel.send(this.embed);
            this.embed.spliceFields(0, this.embed.fields.length);
        }

        if (typeof queue.connection === 'undefined') {
            voiceChannel.join().then(connection => {
                queue.connection = connection;
                this.playMusic(queue);
            }).catch(console.error);
        }

    }

    public playMusic(queue: Queue) {

        if (typeof queue.current === 'undefined') {
            queue.voiceChannel?.leave();
            queue.textChannel?.send('🎵 Music playback has ended');
            return queue = defaultQueue;
        }

        const stream = ytdl(queue.current?.url!, {
            filter: "audioonly",
            opusEncoded: false,
            fmt: "mp3",
            encoderArgs: ['-af', 'bass=g=10,dynaudnorm=f=200'],
            highWaterMark: 1 << 20
        });

        const dispatcher = queue.connection?.play(stream, {
            type: 'unknown',
            highWaterMark: 1024 * 1024 * 10
        });

        dispatcher?.on('finish', () => {
            if (!queue.current?.loop) {
                if (queue.loop) {
                    queue.upcoming.push(queue.current!);
                }
                queue.current = queue.upcoming.shift();
            }
            this.playMusic(queue);
        });

        dispatcher?.setVolumeLogarithmic(queue.volume / 100);

        this.embed
            .setTitle("Now Playing:")
            .setDescription(`[${queue.current.title}](${queue.current.url})`)
            .setThumbnail(queue.current.thumbnail)
            .addField("Duration:", `${client.$utils.formatSeconds(queue.current.duration)}`, true)
            .addField("Requested By:", queue.current.requester.user.tag, true)
            .setTimestamp();

        queue.textChannel?.send(this.embed);
        this.embed.spliceFields(0, this.embed.fields.length);

        dispatcher?.on('error', console.error);

    }
}