const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ActivityType, SlashCommandBuilder, REST, Routes } = require('discord.js');

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

// Define slash commands
const commands = [
    new SlashCommandBuilder()
        .setName('tier-vote')
        .setDescription('Start a professional tier list vote')
        .addStringOption(option =>
            option.setName('topic')
                .setDescription('The topic to vote on')
                .setRequired(true)
                .setMaxLength(100))
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Vote duration (e.g., 30s, 1m, 5m)')
                .setRequired(true)
                .addChoices(
                    { name: '30 seconds', value: '30s' },
                    { name: '1 minute', value: '1m' },
                    { name: '2 minutes', value: '2m' },
                    { name: '3 minutes', value: '3m' },
                    { name: '5 minutes', value: '5m' },
                    { name: '10 minutes', value: '10m' }
                )),
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show TierVote Pro command guide and information')
];

// Register slash commands
async function registerCommands() {
    try {
        console.log('🔄 Registering slash commands...');
        
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands.map(command => command.toJSON()) }
        );
        
        console.log('✅ Successfully registered slash commands globally!');
    } catch (error) {
        console.error('❌ Error registering slash commands:', error);
    }
}

client.on('ready', async () => {
    console.log(`✅ TierVote Pro: ${client.user.tag} is now online and ready!`);
    console.log(`📊 Bot ID: ${client.user.id}`);
    console.log(`🔗 Invite URL: https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=274877916160&scope=bot%20applications.commands`);
    
    // Register slash commands
    await registerCommands();
    
    // Set professional bot status
    client.user.setActivity('tier list votes | /tier-vote', { 
        type: ActivityType.Watching 
    });
});

// Handle slash command interactions
client.on('interactionCreate', async (interaction) => {
    try {
        if (interaction.isChatInputCommand()) {
            console.log(`💬 Slash command received: /${interaction.commandName}`);
            
            if (interaction.commandName === 'tier-vote') {
                await handleSlashVoteCommand(interaction);
            } else if (interaction.commandName === 'help') {
                await handleSlashHelpCommand(interaction);
            }
        } else if (interaction.isStringSelectMenu()) {
            await handleSelectMenu(interaction);
        }
    } catch (error) {
        console.error('❌ Error handling interaction:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setTitle('Error')
            .setDescription('An error occurred while processing your request.')
            .setColor(ERROR_COLOR);
        
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
        } else {
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
});

async function handleSlashVoteCommand(interaction) {
    try {
        console.log('🗳️ Processing slash vote command');
        
        const topic = interaction.options.getString('topic');
        const durationArg = interaction.options.getString('duration');
        
        console.log(`📝 Topic: "${topic}", Duration: "${durationArg}"`);
        
        // Parse and validate duration
        const duration = parseDuration(durationArg);
        if (!duration.valid) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('Invalid Duration Format')
                .setDescription('Please select a valid duration from the dropdown options.')
                .setColor(ERROR_COLOR)
                .setFooter({ text: 'TierVote Pro' })
                .setTimestamp();
            
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        // Check for active vote in channel
        if (activeVotes.has(interaction.channel.id)) {
            const warningEmbed = new EmbedBuilder()
                .setTitle('Vote Already Active')
                .setDescription('There is already an active vote in this channel. Please wait for it to complete before starting a new one.')
                .setColor(WARNING_COLOR)
                .setFooter({ text: 'TierVote Pro' })
                .setTimestamp();
            
            return interaction.reply({ embeds: [warningEmbed], ephemeral: true });
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
                text: `Started by ${interaction.user.displayName} • TierVote Pro`,
                iconURL: interaction.user.displayAvatarURL({ dynamic: true })
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

        const response = await interaction.reply({
            embeds: [voteEmbed],
            components: [row]
        });

        const voteMessage = await response.fetch();

        // Store vote data
        const voteData = {
            topic,
            messageId: voteMessage.id,
            authorId: interaction.user.id,
            authorName: interaction.user.displayName,
            votes: new Map(),
            startTime: Date.now(),
            duration: duration.milliseconds,
            durationText: durationArg
        };

        activeVotes.set(interaction.channel.id, voteData);

        // Set timeout to end vote
        setTimeout(async () => {
            await endVote(interaction.channel.id, voteMessage);
        }, duration.milliseconds);

        // Update vote count every 5 seconds (more frequent for color changes)
        const updateInterval = setInterval(async () => {
            try {
                if (!activeVotes.has(interaction.channel.id)) {
                    clearInterval(updateInterval);
                    return;
                }
                await updateVoteEmbed(voteMessage, voteData);
            } catch (updateError) {
                console.error('Error in update interval:', updateError);
                clearInterval(updateInterval);
            }
        }, 5000); // Changed to 5 seconds for smoother color transitions

    } catch (error) {
        console.error('❌ Error in handleSlashVoteCommand:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setTitle('Error')
            .setDescription('An error occurred while creating the vote. Please try again.')
            .setColor(ERROR_COLOR);
        
        if (interaction.replied) {
            await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
        } else {
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
}

async function handleSlashHelpCommand(interaction) {
    const helpEmbed = new EmbedBuilder()
        .setTitle('TierVote Pro - Command Guide')
        .setDescription('**Professional tier list voting system for Discord communities**')
        .setColor(BRAND_COLOR)
        .addFields([
            {
                name: 'Start a Vote',
                value: '```/tier-vote topic:<topic> duration:<duration>```\n**Examples:**\n• `/tier-vote topic:"Best Framework" duration:2m`\n• `/tier-vote topic:"Product Quality" duration:1m`',
                inline: false
            },
            {
                name: 'Duration Options',
                value: '• `30s` - 30 seconds\n• `1m` - 1 minute\n• `2m` - 2 minutes\n• `3m` - 3 minutes\n• `5m` - 5 minutes\n• `10m` - 10 minutes',
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
                value: '• Real-time vote tracking\n• Automatic tier averaging\n• Professional result display\n• One vote per user\n• Vote modification allowed\n• Voter analysis (highest/lowest ratings)',
                inline: false
            }
        ])
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: 'TierVote Pro • Professional Voting Solution' })
        .setTimestamp();

    await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
}

async function handleSelectMenu(interaction) {
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

function formatTimeRemaining(milliseconds) {
    if (milliseconds <= 0) return '0s';
    
    const seconds = Math.ceil(milliseconds / 1000);
    if (seconds < 60) return `${seconds}s`;
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

async function updateVoteEmbed(voteMessage, voteData) {
    try {
        const voteCount = voteData.votes.size;
        const timeRemaining = Math.max(0, voteData.duration - (Date.now() - voteData.startTime));
        const timeRemainingText = formatTimeRemaining(timeRemaining);
        
        // Get dynamic color based on remaining time
        const dynamicColor = getDynamicColor(timeRemaining, voteData.duration);
        const statusWithColor = getStatusWithColor(timeRemaining, voteData.duration);

        const updatedEmbed = EmbedBuilder.from(voteMessage.embeds[0])
            .setColor(dynamicColor) // Dynamic color that changes over time
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
                    value: statusWithColor, // Status with colored emoji
                    inline: true
                }
            ]);

        await voteMessage.edit({ embeds: [updatedEmbed] });
    } catch (error) {
        console.error('Error updating vote embed:', error);
    }
}

function getDynamicColor(timeRemaining, totalDuration) {
    // Calculate progress (0 = start, 1 = end)
    const progress = 1 - (timeRemaining / totalDuration);
    
    // Color transition: Blue -> Purple -> Pink -> Red -> Orange -> Yellow
    if (progress <= 0.2) {
        // Blue to Purple (0-20%)
        const localProgress = progress / 0.2;
        const r = Math.floor(88 + (148 * localProgress));   // 88 -> 236
        const g = Math.floor(101 + (-37 * localProgress));  // 101 -> 64
        const b = Math.floor(242 + (-102 * localProgress)); // 242 -> 140
        return (r << 16) | (g << 8) | b;
    } else if (progress <= 0.4) {
        // Purple to Pink (20-40%)
        const localProgress = (progress - 0.2) / 0.2;
        const r = Math.floor(236 + (19 * localProgress));   // 236 -> 255
        const g = Math.floor(64 + (128 * localProgress));   // 64 -> 192
        const b = Math.floor(140 + (63 * localProgress));   // 140 -> 203
        return (r << 16) | (g << 8) | b;
    } else if (progress <= 0.6) {
        // Pink to Red (40-60%)
        const localProgress = (progress - 0.4) / 0.2;
        const r = 255;                                       // 255 -> 255
        const g = Math.floor(192 + (-127 * localProgress)); // 192 -> 65
        const b = Math.floor(203 + (-138 * localProgress)); // 203 -> 65
        return (r << 16) | (g << 8) | b;
    } else if (progress <= 0.8) {
        // Red to Orange (60-80%)
        const localProgress = (progress - 0.6) / 0.2;
        const r = 255;                                       // 255 -> 255
        const g = Math.floor(65 + (100 * localProgress));   // 65 -> 165
        const b = 65;                                        // 65 -> 65
        return (r << 16) | (g << 8) | b;
    } else {
        // Orange to Yellow (80-100%)
        const localProgress = (progress - 0.8) / 0.2;
        const r = 255;                                       // 255 -> 255
        const g = Math.floor(165 + (90 * localProgress));   // 165 -> 255
        const b = Math.floor(65 + (65 * localProgress));    // 65 -> 130
        return (r << 16) | (g << 8) | b;
    }
}

function getStatusWithColor(timeRemaining, totalDuration) {
    const progress = 1 - (timeRemaining / totalDuration);
    
    if (progress <= 0.2) return '🔵 Active';
    else if (progress <= 0.4) return '🟣 Active';
    else if (progress <= 0.6) return '🟡 Active';
    else if (progress <= 0.8) return '🟠 Active';
    else return '🔴 Ending Soon';
}

client.on('interactionCreate', async (interaction) => {
    try {
        if (interaction.isChatInputCommand()) {
            console.log(`💬 Slash command received: /${interaction.commandName}`);
            
            if (interaction.commandName === 'tier-vote') {
                await handleSlashVoteCommand(interaction);
            } else if (interaction.commandName === 'help') {
                await handleSlashHelpCommand(interaction);
            }
        } else if (interaction.isStringSelectMenu()) {
            await handleSelectMenu(interaction);
        }
    } catch (error) {
        console.error('❌ Error handling interaction:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setTitle('Error')
            .setDescription('An error occurred while processing your request.')
            .setColor(ERROR_COLOR);
        
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
        } else {
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
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
console.log('🚀 Attempting to login...');
client.login(process.env.DISCORD_TOKEN)
    .then(() => {
        console.log('✅ Login successful!');
    })
    .catch((error) => {
        console.error('❌ Login failed:', error);
        console.error('🔍 Check your DISCORD_TOKEN environment variable');
        process.exit(1);
    });
