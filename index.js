const { messages } = require('discord-fetch-all');
const { MessageEmbed } = require('discord.js');
const fs = require('fs');
const Discord = require('discord.js');
const client = new Discord.Client({intents: ["GUILDS", "GUILD_MESSAGES", "GUILD_MESSAGE_REACTIONS"]});
const config = require('./config.json')


// TODO loop review


client.on('ready', () => {
    console.log('Online...')
});

client.on('message', msg => {
    
    if (msg.author.bot) return;

    const channel = client.channels.cache.get(msg.channelId);

    // User mentions bot, add original message to contexts
    if (msg.type == 'REPLY' && msg.content == '<@!960541616907649114>') {

        channel.messages.fetch(Object.values(msg.reference)[2])
        .then (message => {
            msg.reply("Added.")
            addToContexts(message);
            return;
        })
        .catch (console.error);
    }

    if (msg.content.toLowerCase().startsWith(config.prefix)) {

        
        let command = msg.content.substring(config.prefix.length + 1).toLowerCase();
        console.log(`command: '${command}' by ${msg.author.username}`)

        // random out of context message
        if (command == "lets play") {
            // msg.reply('work in progress');
            outOfContextGame(channel, msg.author);
            msg.delete()
            return;

        // review the previous message to add to contexts or not
        } else if (command == "review") { 
            
            reviewMessage(channel, msg.author);
            msg.delete()
            return;

        } else if (command == "help" || command == "info") {

            const helpEmbed = new MessageEmbed()
            .setTitle('Info')
            .setDescription("list of possible commands⬇")
            .setColor('#0099ff')
            .addFields(
                { name: "ayo lets play", value: "Sends random Out Of Context message, click the ❌ to remove the embed. This wil NOT remove the quote from the database."},
                { name: "ayo review", value: "Review a message, click the 👍 to add the message to the database, click 👎 to not add the message. "},
                { name: "ayo skip id", value: "Right click on message, click 'Copy ID' and now type 'ayo skip id'(replace id with the actual id eg. 961509997722873896). The review will now start with that following message. Useful if there are long conversations without any Out Of Context message."},
                { name: "respond to message with @WhereContextBot", value: "This adds the message you responded to to the database."},
                { name: "ayo help / ayo info", value: "Info about the commands."}
            )
            .setThumbnail(msg.author.avatarURL({ dynamic:true }))

            channel.send({embeds: [helpEmbed]});

            msg.delete()
            return;


        } else if (command.includes('skip')) {

            const id = command.substring(5)
            msg.reply(`last reviewed is now ${id}`);
            updateLastID(id);
            return;

        } else {
            msg.reply("fuck u mean bro??");
        }
        return;

    }
});

async function outOfContextGame (channel, requester) {
    
    // Get random from contexts.json
    let rawdata = fs.readFileSync('contexts.json');
    let jsonData = JSON.parse(rawdata);

    const values = Object.values(jsonData)
    const tempChosenMessage = values[parseInt(Math.random() * values.length)];
    const chosenMessage = Object.values(tempChosenMessage)[0]
    
    channel.messages.fetch(chosenMessage.id)
    .then (message => {
        // send embed with message back
        let messageAttachment = message.attachments.size > 0 ? Object.values(message.attachments.first())[4] : null
        const gameEmbed = new MessageEmbed()
            .setTitle('Out of context game')
            .setURL(message.url)
            .setDescription(message.cleanContent)
            .setThumbnail(message.author.avatarURL({ dynamic:true }))
            .setFooter("Click ❌ to remove this embed")
            if (messageAttachment) gameEmbed.setImage(messageAttachment)

        channel.send({embeds: [gameEmbed]}).then(sentEmbed => {

            sentEmbed.react("❌");

            const filter = (reaction, user) => {
                return ['❌'].includes(reaction.emoji.name) && user === requester;
            };

            sentEmbed.awaitReactions({ filter, max: 1, time: 16000, errors: ['time'] })
            .then(collected => {
                const reaction = collected.first();
                if (reaction.emoji.name === '❌') {
                    sentEmbed.delete();
                }
            })
            .catch(console.error);
        })
    })
    .catch(console.error);
    return;
};

async function reviewMessage (channel, requester) {

    // Get last ID 
    const lastID = config.lastID;

    await channel.messages.fetch({limit: 1, before: lastID})
    .then(message => {
        const reviewMessage = message.first();
        // message can not be command from user or bot
        if (reviewMessage.author.bot == false && reviewMessage.content.toLowerCase().startsWith(config.prefix) == false) {

            // autoadd messages containing ""
            if (reviewMessage.content.includes('"')) {
                addToContexts(reviewMessage);
                config.lastID = reviewMessage.id;
                return;
            } 

            // send embed for review
            let messageAttachment = reviewMessage.attachments.size > 0 ? Object.values(reviewMessage.attachments.first())[4] : null;
            const reviewEmbed = new MessageEmbed()
                .setTitle(`Review Quote by ${reviewMessage.author.username}`)
                .setURL(reviewMessage.url)
                .setDescription(reviewMessage.content)
                .setThumbnail(reviewMessage.author.avatarURL({ dynamic:true }))
                .setFooter("Click 👍 to add, click 👎 to skip")

                if (messageAttachment) reviewEmbed.setImage(messageAttachment)

            // Check if user wants to add message 
            channel.send({embeds: [reviewEmbed]}).then(sentEmbed => {
                sentEmbed.react("👍");
                sentEmbed.react("👎");

                const filter = (reaction, user) => {
                    return ['👍', '👎'].includes(reaction.emoji.name) && user === requester;
                };

                sentEmbed.awaitReactions({ filter, max: 1, time: 16000, errors: ['time'] })
                .then(collected => {
                    const reaction = collected.first();

                    if (reaction.emoji.name === '👍') {

                        // User approves, add it to contexts.json
                        addToContexts(reviewMessage);
                        
                        // create new embed using original as starter
                        const newReviewEmbed = new MessageEmbed()
                            .setTitle('Added.')
                            .setURL(reviewMessage.url)
                            .setDescription(reviewMessage.content)
                            .setThumbnail(reviewMessage.author.avatarURL({ dynamic:true }))
                            if (messageAttachment) reviewEmbed.setImage(messageAttachment)
                        sentEmbed.edit({embeds: [newReviewEmbed]});

                        // change last ID
                        updateLastID(reviewMessage.id);
                        console.log(`added ${reviewMessage.id}`)
                        // delete Embed
                        setTimeout(function () {
                            sentEmbed.delete()
                        }, 1750)

                    } else {
                        
                        // User does not approve, skip message
                        const newReviewEmbed = new MessageEmbed()
                            .setTitle('Did not add.')
                            .setURL(reviewMessage.url)
                            .setDescription(reviewMessage.content)
                            .setThumbnail(reviewMessage.author.avatarURL({ dynamic:true }))
                            if (messageAttachment) reviewEmbed.setImage(messageAttachment)
                        sentEmbed.edit({embeds: [newReviewEmbed]});

                        // change last ID
                        updateLastID(reviewMessage.id);
                        console.log(`did not add ${reviewMessage.id}`)

                        // delete Embed
                        setTimeout(function () {
                            sentEmbed.delete()
                        }, 1250)
                    }
                })
                .catch(collected => {
                    const temp = sentEmbed.reply('You reacted with neither a thumbs up, nor a thumbs down.');
                    console.log("No response...")
                    // delete Embed
                    setTimeout(function () {
                        sentEmbed.delete()

                    }, 1250)
                });
            });

            return;

        } else {
            // skip current message and go to next one
            updateLastID(reviewMessage.id);
            return;
        }
    })
    .catch(console.error);
     
};

function addToContexts (message) {
    // Storing the JSON format data in myObject
    var data = fs.readFileSync("contexts.json");
    var myObject = JSON.parse(data);
    
    // Defining new data to be added
    let newData = {
        message: message
    };
    
    // Adding the new data to our object
    myObject.push(newData);
    
    // Writing to our JSON file
    var newData2 = JSON.stringify(myObject);
    fs.writeFile("contexts.json", newData2, (err) => {
        // Error checking
        if (err) throw err;
        console.log("New data added");
    });
    return;
};

function updateLastID (newID) {
    const fs = require('fs');
    const fileName = './config.json';
    const file = require(fileName);
        
    file.lastID = newID;

    fs.writeFile(fileName, JSON.stringify(file), function writeJSON(err) {
        if (err) return console.log(err);
    });
    return;
};


client.login(config.token);