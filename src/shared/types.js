/**
 * @typedef {Object} TrackedProject
 * @property {string} name
 * @property {string} path
 * @property {string} [githubRepo] - "owner/repo" format
 * @property {string} lastChecked - ISO date
 * @property {string} lastCommitDate - ISO date
 * @property {number} openIssuesCount
 * @property {boolean} hasBacklog
 * @property {boolean} manuallyAdded
 */

/**
 * @typedef {Object} Suggestion
 * @property {string} id
 * @property {string} type - ACTION_TYPES value
 * @property {string} projectName
 * @property {string} title
 * @property {string} description
 * @property {string} createdAt - ISO date
 * @property {'pending'|'approved'|'dismissed'|'executed'} status
 * @property {string} [discordMessageId]
 * @property {Object} [payload] - type-specific data
 */

/**
 * @typedef {Object} ProjectScanResult
 * @property {string} name
 * @property {string} path
 * @property {string} lastCommitDate
 * @property {string} [githubRemote]
 * @property {boolean} hasBacklog
 * @property {string[]} backlogItems
 */

/**
 * @typedef {Object} DailyDigest
 * @property {string} date
 * @property {number} projectsChecked
 * @property {number} suggestionsMade
 * @property {number} actionsApproved
 * @property {number} actionsDismissed
 * @property {TrackedProject[]} staleProjects
 * @property {Suggestion[]} pendingSuggestions
 */

module.exports = {};
