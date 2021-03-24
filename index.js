const Discord = require('discord.js')
const ytdl = require('ytdl-core')
const { YTSearcher } = require('ytsearcher')

const searcher = new YTSearcher({
    key: process.env.YTSEARCHER_KEY,
    revealed: true
})

const token = process.env.TOKEN

const app = new Discord.Client()
let imReady = false
let conn
let queue = new Map()

app.on('ready', () => {
    console.log('Estou conectado!')
})

app.on('message', async (msg) => {

    const serverQueue = queue.get(msg.guild.id)

    // !join - se juntar ao canal de voz
    if ( msg.content === '.j' || msg.content === '.join' ) {
        if ( !msg.member.voice.channel ) return msg.channel.send('Você precisa estar conectado a um canal de voz!')
            
        conn = await msg.member.voice.channel.join();
        if (conn) imReady = true
    }
    // !leave - sair do canal 
    else if ( msg.content === '.l' || msg.content === '.leave' ) {
        if ( !msg.member.voice.channel ) return msg.channel.send('Você precisa estar conectado a um canal de voz!')
       
        msg.member.voice.channel.leave()
        imReady = false
    }
    // !play [link] = tocar a musica do yt
    else if ( msg.content.startsWith('.p ') || msg.content.startsWith('.play ') ) {

        if ( !msg.member.voice.channel ) return msg.channel.send('Você precisa estar conectado a um canal de voz!')

        let finalUrlNameSong = ''
        let link = msg.content.split(' ')

        console.log(link.length)

        if ( link.length > 2 ) {
            link.shift()
            let result = await searcher.search(link.join(' '), {type: 'video'})            
            finalUrlNameSong = result.first.url
        } else {
            finalUrlNameSong = link[1]
        }

        console.log(ytdl.validateURL(finalUrlNameSong))

        if ( !ytdl.validateURL(finalUrlNameSong) ) return msg.channel.send('Link/Nome inválido') 

        const songInfo = await ytdl.getInfo(finalUrlNameSong)

        let song = {
            title: songInfo.videoDetails.title,
            url: songInfo.videoDetails.video_url
        }

        if ( !serverQueue ) {
            const queueConstructor = {
                txtChannel: msg.channel,
                vChannel: msg.member.voice.channel,
                connection: null,
                songs: [],
                volume: 50,
                playing: true
            }
            queue.set(msg.guild.id, queueConstructor)

            queueConstructor.songs.push(song)

            try {
                conn = await msg.member.voice.channel.join();
                queueConstructor.connection = conn
                play(msg.guild, queueConstructor.songs[0])
            } catch ( e ) {
                console.error(e)
                queue.delete(msg.guild.id)
                return msg.channel.send('Ocorreu algum erro...')
            }
        } else {
            serverQueue.songs.push(song)
            return msg.channel.send(`Música adicionada a fila: ${song.title}`)
        }

        // currentSong = conn.play(ytdl(link, { filter: 'audioonly' }));
          
    }

    // setting volume
    else if ( msg.content.startsWith('.v ') || msg.content.startsWith('.volume ') ) {

        let vol = msg.content.split(' ')
        vol = vol[1]

        if ( !serverQueue.playing ) return msg.channel.send('É necessário colocar uma música primeiro')

        serverQueue.connection.dispatcher.setVolume(vol);
    }

    else if ( msg.content.startsWith('.s') || msg.content.startsWith('.skip') ) {
        skip(msg, serverQueue)
    }

    else if ( msg.content.startsWith('.stop') ) {
        stop(msg, serverQueue)
    }

    function play(guild, song) {
        const serverQueue = queue.get(guild.id)

        if (!song) {
            serverQueue.vChannel.leave()
            queue.delete(guild.id)
            return
        }

        serverQueue.txtChannel.send(`Tocando agora: ${song.url}`)

        const dispatcher = serverQueue.connection
            .play(ytdl(song.url, { filter: 'audioonly' }))
            .on('finish', () => {
                serverQueue.songs.shift()
                play(guild, serverQueue.songs[0])
            })
    }

    async function stop (msg, serverQueue ) {
        if (!msg.member.voice.channel) {
            return msg.channel.send('Entre em um canal de voz primeiro')
        }
        serverQueue.songs = []
        serverQueue.txtChannel.send('Xau 👄')
        serverQueue.connection.dispatcher.end()
    }

    function skip(msg, serverQueue) {
        if (!msg.member.voice.channel) 
            return msg.channel.send('Entre em um canal de voz primeiro')
        
        if (!serverQueue)
            return msg.channel.send('Não tem nada para pular')

        serverQueue.connection.dispatcher.end()

    }
})

app.login(token)