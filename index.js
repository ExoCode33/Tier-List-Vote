const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ActivityType } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// Store active votes
const activeVotes = new Map();

// Professional tier configuration
const tierConfig = {
    'S': { 
        value: 6, 
        label: 'S-Tier', 
        description: 'Exceptional - Outstanding performance and quality',
        color: '#FFD700'
    },
    'A': { 
        value: 5, 
        label: 'A-Tier', 
        description: 'Excellent - High quality with minor areas for improvement',
        color: '#4A90E2'
    },
    'B': { 
        value: 4, 
        label: 'B-Tier', 
        description: 'Very Good - Above average with solid performance',
        color: '#50C878'
    },
    'C': { 
        value: 3, 
        label: 'C-Tier', 
        description: 'Average - Meets expectations with standard quality',
        color: '#FFA500'
    },
    'D': { 
        value: 2, 
        label: 'D-Tier', 
        description: 'Below Average - Subpar performance needing improvement',
        color: '#FF6B6B'
    },
    'E': { 
        value: 1, 
        label: 'E-Tier', 
        description: 'Poor - Significant issues and poor quality',
        color: '#DC143C'
    }
};

const BRAND_COLOR = 0x5865F2; // Discord Blurple
const SUCCESS_COLOR = 0x57F287; // Discord Green
const WARNING_COLOR = 0xFEE75C; // Discord Yellow
const ERROR_COLOR = 0xED4245; // Discord Red

client.on('ready', () => {
    console.log(`TierVote Pro: ${client.user.tag} is now online and ready!`);
    
    // Set professional bot status
    client.user.setActivity('tier list votes | /Tier-Vote', { 
        type: ActivityType.Watching 
    });
});

client.on('messageCreate', async (message) => {
    try {
        if (message.author.bot) return;

        // Debug logging
        console.log(`Message received: "${message.content}"`);

        // Handle /Tier-Vote command (case insensitive)
        if (message.content.toLowerCase().startsWith('/tier-vote')) {
            console.log('Tier-Vote command detected!');
            await handleVoteCommand(message);
            return;
        }
        
        // Handle /help command
        if (message.content === '/help' || message.content === '/commands') {
            await sendHelpMessage(message);
            return;
        }

        // Test command to verify bot is working
        if (message.content === '/test') {
            await message.reply('✅ Bot is working! Try `/Tier-Vote "Test Topic" 30s`');
            return;
        }
    } catch (error) {
        console.error('Error in messageCreate:', error);
        try {
            await message.reply('❌ An error occurred. Please try again.');
        } catch (replyError) {
            console.error('Failed to send error message:', replyError);
        }
    }
});

async function handleVoteCommand(message) {
    try {
        console.log('handleVoteCommand called');
        const args = message.content.split(' ');
        console.log('Args:', args);
        
        if (args.length < 3) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('Invalid Command Usage')
                .setDescription('**Correct Usage:**\n```/Tier-Vote <topic> <duration>```\n\n**Examples:**\n• `/Tier-Vote "Best Development Framework" 1m`\n• `/Tier-Vote "Test Topic" 30s`\n• `/Tier-Vote "Product Feature Priority" 2m`')
                .setColor(ERROR_COLOR)
                .setFooter({ text: 'TierVote Pro • Professional Voting System' })
                .setTimestamp();
            
            return message.reply({ embeds: [errorEmbed] });
        }

        const topic = args.slice(1, -1).join(' ');
        const durationArg = args[args.length - 1].toLowerCase();
        
        // Parse and validate duration
        const duration = parseDuration(durationArg);
        if (!duration.valid) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('Invalid Duration Format')
                .setDescription('**Valid Duration Formats:**\n• `30s` - 30 seconds\n• `1m` - 1 minute\n• `5m` - 5 minutes\n\n**Duration Limits:** 15 seconds to 10 minutes')
                .setColor(ERROR_COLOR)
                .setFooter({ text: 'TierVote Pro' })
                .setTimestamp();
            
            return message.reply({ embeds: [errorEmbed] });
        }

        // Check for active vote in channel
        if (activeVotes.has(message.channel.id)) {
            const warningEmbed = new EmbedBuilder()
                .setTitle('Vote Already Active')
                .setDescription('There is already an active vote in this channel. Please wait for it to complete before starting a new one.')
                .setColor(WARNING_COLOR)
                .setFooter({ text: 'TierVote Pro' })
                .setTimestamp();
            
            return message.reply({ embeds: [warningEmbed] });
        }

        // Create professional voting embed
        const voteEmbed = new EmbedBuilder()
            .setTitle(`Tier List Vote`)
            .setDescription(`**Topic:** ${topic}\n\nSelect your tier classification from the dropdown menu below. Each tier represents a different level of quality and performance.\n\n**Tier Classifications:**\n${Object.entries(tierConfig).map(([tier, config]) => 
                `**${config.label}** - ${config.description.split(' - ')[1]}`
            ).join('\n')}`)
            .setColor(BRAND_COLOR)
            .addFields([
                {
                    name: 'Vote Duration',
                    value: `${durationArg}`,
                    inline: true
                },
                {
                    name: 'Participants',
                    value: '0 votes',
                    inline: true
                },
                {
                    name: 'Status',
                    value: 'Active',
                    inline: true
                }
            ])
            .setFooter({ 
                text: `Started by ${message.author.displayName} • TierVote Pro`,
                iconURL: message.author.displayAvatarURL({ dynamic: true })
            })
            .setTimestamp();

        // Create professional dropdown menu
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('tier_vote_select')
            .setPlaceholder('Select a tier classification')
            .addOptions(
                Object.entries(tierConfig).map(([tier, config]) => ({
                    label: config.label,
                    description: config.description,
                    value: `vote_${tier}`
                }))
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const voteMessage = await message.channel.send({
            embeds: [voteEmbed],
            components: [row]
        });

        // Store vote data
        const voteData = {
            topic,
            messageId: voteMessage.id,
            authorId: message.author.id,
            authorName: message.author.displayName,
            votes: new Map(),
            startTime: Date.now(),
            duration: duration.milliseconds,
            durationText: durationArg
        };

        activeVotes.set(message.channel.id, voteData);

        // Set timeout to end vote
        setTimeout(async () => {
            await endVote(message.channel.id, voteMessage);
        }, duration.milliseconds);

        // Update vote count every 10 seconds
        const updateInterval = setInterval(async () => {
            try {
                if (!activeVotes.has(message.channel.id)) {
                    clearInterval(updateInterval);
                    return;
                }
                await updateVoteEmbed(voteMessage, voteData);
            } catch (updateError) {
                console.error('Error in update interval:', updateError);
                clearInterval(updateInterval);
            }
        }, 10000);

    } catch (error) {
        console.error('Error in handleVoteCommand:', error);
        try {
            await message.reply('❌ An error occurred while creating the vote. Please try again.');
        } catch (replyError) {
            console.error('Failed to send error message:', replyError);
        }
    }
}

async function sendHelpMessage(message) {
    const helpEmbed = new EmbedBuilder()
        .setTitle('TierVote Pro - Command Guide')
        .setDescription('**Professional tier list voting system for Discord communities**')
        .setColor(BRAND_COLOR)
        .addFields([
            {
                name: 'Start a Vote',
                value: '```/Tier-Vote <topic> <duration>```\n**Examples:**\n• `/Tier-Vote "Performance Framework" 2m`\n• `/Tier-Vote "Product Quality Assessment" 1m`',
                inline: false
            },
            {
                name: 'Duration Formats',
                value: '• `30s` - 30 seconds\n• `1m` - 1 minute\n• `5m` - 5 minutes\n• **Range:** 15s to 10m',
                inline: true
            },
            {
                name: 'Tier System',
                value: `${Object.entries(tierConfig).map(([tier, config]) => 
                    `**${tier}** - ${config.description.split(' - ')[1]}`
                ).join('\n')}`,
                inline: true
            },
            {
                name: 'Features',
                value: '• Real-time vote tracking\n• Automatic tier averaging\n• Professional result display\n• One vote per user\n• Vote modification allowed',
                inline: false
            }
        ])
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: 'TierVote Pro • Professional Voting Solution' })
        .setTimestamp();

    await message.reply({ embeds: [helpEmbed] });
}

function parseDuration(durationStr) {
    const match = durationStr.match(/^(\d+)([sm])$/);
    if (!match) return { valid: false };

    const [, amount, unit] = match;
    const num = parseInt(amount);
    
    let milliseconds;
    if (unit === 's') {
        milliseconds = num * 1000;
    } else if (unit === 'm') {
        milliseconds = num * 60 * 1000;
    }

    const valid = milliseconds >= 15000 && milliseconds <= 600000;
    return { valid, milliseconds };
}

async function updateVoteEmbed(voteMessage, voteData) {
    try {
        const voteCount = voteData.votes.size;
        const timeRemaining = Math.max(0, voteData.duration - (Date.now() - voteData.startTime));
        const timeRemainingText = formatTimeRemaining(timeRemaining);

        const updatedEmbed = EmbedBuilder.from(voteMessage.embeds[0])
            .setFields([
                {
                    name: 'Time Remaining',
                    value: timeRemainingText,
                    inline: true
                },
                {
                    name: 'Participants',
                    value: `${voteCount} vote${voteCount !== 1 ? 's' : ''}`,
                    inline: true
                },
                {
                    name: 'Status',
                    value: timeRemaining > 0 ? 'Active' : 'Ending',
                    inline: true
                }
            ]);

        await voteMessage.edit({ embeds: [updatedEmbed] });
    } catch (error) {
        console.error('Error updating vote embed:', error);
    }
}

function formatTimeRemaining(milliseconds) {
    if (milliseconds <= 0) return '0s';
    
    const seconds = Math.ceil(milliseconds / 1000);
    if (seconds < 60) return `${seconds}s`;
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;

    if (interaction.customId !== 'tier_vote_select') return;

    const channelId = interaction.channel.id;
    const voteData = activeVotes.get(channelId);

    if (!voteData) {
        const errorEmbed = new EmbedBuilder()
            .setTitle('Vote Expired')
            .setDescription('This vote has already ended or expired.')
            .setColor(ERROR_COLOR)
            .setFooter({ text: 'TierVote Pro' });
        
        return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    const selectedValue = interaction.values[0];
    if (!selectedValue.startsWith('vote_')) return;

    const tier = selectedValue.split('_')[1];
    const userId = interaction.user.id;
    const config = tierConfig[tier];

    // Record the vote
    const previousVote = voteData.votes.get(userId);
    voteData.votes.set(userId, tier);

    const responseEmbed = new EmbedBuilder()
        .setTitle('Vote Recorded')
        .setDescription(`You selected **${config.label}**\n\n${config.description}`)
        .setColor(parseInt(config.color.replace('#', ''), 16))
        .setFooter({ text: previousVote ? 'Vote updated • TierVote Pro' : 'Vote recorded • TierVote Pro' })
        .setTimestamp();

    await interaction.reply({ 
        embeds: [responseEmbed], 
        ephemeral: true 
    });
});

async function endVote(channelId, voteMessage) {
    const voteData = activeVotes.get(channelId);
    if (!voteData) return;

    const votes = voteData.votes;
    const channel = voteMessage.channel;

    // Calculate comprehensive results
    const tierCounts = { S: 0, A: 0, B: 0, C: 0, D: 0, E: 0 };
    let totalVotes = 0;
    let totalValue = 0;

    // Track highest and lowest ratings
    let highestRating = { value: 0, users: [], tier: '' };
    let lowestRating = { value: 7, users: [], tier: '' };

    for (const [userId, tier] of votes.entries()) {
        const tierValue = tierConfig[tier].value;
        tierCounts[tier]++;
        totalVotes++;
        totalValue += tierValue;

        // Track highest ratings
        if (tierValue > highestRating.value) {
            highestRating = { value: tierValue, users: [userId], tier: tier };
        } else if (tierValue === highestRating.value) {
            highestRating.users.push(userId);
        }

        // Track lowest ratings
        if (tierValue < lowestRating.value) {
            lowestRating = { value: tierValue, users: [userId], tier: tier };
        } else if (tierValue === lowestRating.value) {
            lowestRating.users.push(userId);
        }
    }

    // Calculate average and determine final tier
    let finalTier = 'E';
    let averageScore = 0;
    
    if (totalVotes > 0) {
        averageScore = totalValue / totalVotes;
        
        if (averageScore >= 5.5) finalTier = 'S';
        else if (averageScore >= 4.5) finalTier = 'A';
        else if (averageScore >= 3.5) finalTier = 'B';
        else if (averageScore >= 2.5) finalTier = 'C';
        else if (averageScore >= 1.5) finalTier = 'D';
        else finalTier = 'E';
    }

    const finalConfig = tierConfig[finalTier];
    
    // Helper function to get user display names
    async function getUserDisplayNames(userIds) {
        const names = [];
        for (const userId of userIds) {
            try {
                const user = await channel.guild.members.fetch(userId);
                names.push(user.displayName || user.user.username);
            } catch (error) {
                names.push('Unknown User');
            }
        }
        return names;
    }

    // Get display names for highest and lowest voters
    const highestVoterNames = totalVotes > 0 ? await getUserDisplayNames(highestRating.users) : [];
    const lowestVoterNames = totalVotes > 0 ? await getUserDisplayNames(lowestRating.users) : [];

    // Format user mentions
    const formatUsers = (names) => {
        if (names.length === 0) return 'None';
        if (names.length === 1) return names[0];
        if (names.length === 2) return `${names[0]} and ${names[1]}`;
        return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
    };
    
    // Create professional results embed
    const resultsEmbed = new EmbedBuilder()
        .setTitle('Vote Results')
        .setDescription(`**Topic:** ${voteData.topic}`)
        .setColor(SUCCESS_COLOR)
        .addFields([
            {
                name: `Final Tier Classification`,
                value: `**${finalConfig.label}**\n${finalConfig.description}\n\nAverage Score: ${averageScore.toFixed(2)}/6.00`,
                inline: false
            },
            {
                name: 'Vote Distribution',
                value: Object.entries(tierCounts)
                    .filter(([, count]) => count > 0)
                    .map(([tier, count]) => {
                        const config = tierConfig[tier];
                        const percentage = ((count / totalVotes) * 100).toFixed(1);
                        return `**${config.label}**: ${count} vote${count !== 1 ? 's' : ''} (${percentage}%)`;
                    })
                    .join('\n') || 'No votes received',
                inline: true
            },
            {
                name: 'Statistics',
                value: `**Total Participants:** ${totalVotes}\n**Vote Duration:** ${voteData.durationText}\n**Completion Rate:** 100%`,
                inline: true
            }
        ]);

    // Add voter analysis if there are votes
    if (totalVotes > 0) {
        resultsEmbed.addFields([
            {
                name: 'Voter Analysis',
                value: `**Highest Rating (${tierConfig[highestRating.tier].label}):** ${formatUsers(highestVoterNames)}\n**Lowest Rating (${tierConfig[lowestRating.tier].label}):** ${formatUsers(lowestVoterNames)}`,
                inline: false
            }
        ]);
    }

    resultsEmbed.setFooter({
        text: `Vote ended • Started by ${voteData.authorName} • TierVote Pro`,
        iconURL: voteMessage.client.users.cache.get(voteData.authorId)?.displayAvatarURL({ dynamic: true })
    })
    .setTimestamp();

    // Create disabled dropdown for final display
    const disabledSelectMenu = new StringSelectMenuBuilder()
        .setCustomId('tier_vote_select_disabled')
        .setPlaceholder('Vote has ended')
        .setDisabled(true)
        .addOptions([
            {
                label: 'Vote Ended',
                description: 'This vote is no longer active',
                value: 'disabled'
            }
        ]);

    const disabledRow = new ActionRowBuilder().addComponents(disabledSelectMenu);

    // Update original message
    const finalVoteEmbed = EmbedBuilder.from(voteMessage.embeds[0])
        .setColor(0x747F8D) // Gray color for ended vote
        .setFields([
            {
                name: 'Status',
                value: 'Ended',
                inline: true
            },
            {
                name: 'Final Count',
                value: `${totalVotes} vote${totalVotes !== 1 ? 's' : ''}`,
                inline: true
            },
            {
                name: 'Result',
                value: finalConfig.label,
                inline: true
            }
        ]);

    await voteMessage.edit({
        embeds: [finalVoteEmbed],
        components: [disabledRow]
    });

    // Send comprehensive results
    await channel.send({ embeds: [resultsEmbed] });

    // Cleanup
    activeVotes.delete(channelId);
}

// Enhanced error handling with keep-alive
process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
    // Don't exit on unhandled rejections in production
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    // Don't exit immediately, try to recover
    setTimeout(() => {
        console.log('Attempting to recover...');
    }, 1000);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('🔄 Shutting down gracefully...');
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('🔄 Received SIGTERM, shutting down gracefully...');
    client.destroy();
    process.exit(0);
});

// Keep the process alive
setInterval(() => {
    console.log('Bot heartbeat - Active votes:', activeVotes.size);
}, 300000); // Every 5 minutes

// Login with bot token
client.login(process.env.DISCORD_TOKEN);
