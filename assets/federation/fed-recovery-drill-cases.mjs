export const recoveryCases = {
  'lost-phone': {
    title: 'Your phone is missing',
    story: 'You set up a Phantom wallet with a recovery phrase. The backup is available offline, and you have a trusted replacement device.',
    facts: [
      ['Wallet type', 'Self-custody'],
      ['Backup in this case', 'Recovery phrase available offline']
    ],
    source: {
      label: 'Phantom’s wallet restoration guide',
      href: 'https://help.phantom.com/articles/sign-in-to-or-import-an-existing-wallet-in-phantom-15079894392851',
      note: 'Phantom documents different paths for a recovery phrase, an imported private key, an original sign-in, and a hardware wallet.'
    },
    decisions: [
      {
        question: 'Where do you start?',
        choices: [
          ['Open Phantom’s official restoration guide on the replacement device.', 'Phantom’s guide points to the path for your original setup. Use the official wallet app and the backup for that wallet.'],
          ['Ask someone on social media to restore it for you.', 'An unofficial contact has no recovery authority. Look for the wallet maker’s documented recovery flow.'],
          ['Ask wallet support to retrieve your recovery phrase.', 'Keep the offline backup. Phantom cannot retrieve the recovery phrase for you.']
        ],
        correct: 0
      },
      {
        update: 'Your main wallet opens. An account you previously imported from a separate backup is missing.',
        question: 'What should you check next?',
        choices: [
          ['Assume the account and assets disappeared.', 'A missing account view can mean the wallet has not restored that account yet. Use the public address in your records to identify it.'],
          ['Find the backup for the imported account and check its public address.', 'Accounts imported with a different phrase or private key have their own recovery path. Compare the public address with your records.'],
          ['Wait for the account to transfer to the new device by itself.', 'Account access depends on its own backup. A device change by itself does not move the assets.']
        ],
        correct: 1
      }
    ],
    finish: 'Record your original sign-in or backup type. Note which separately imported accounts have their own backups, then walk through the official recovery path.'
  },
  'missed-check-in': {
    title: 'The check-in was missed',
    story: 'A fictional family plan has started a review period. The owner can cancel during that period. A designated guardian can pause the plan, and release would require guardian approval after the review.',
    facts: [
      ['Today', 'Day 3 of the review'],
      ['Challenge closes', 'End of day 14'],
      ['Current stage', 'Review open']
    ],
    source: {
      label: 'Casa’s Bitcoin inheritance request process',
      href: 'https://support.casa.io/knowledge/basic-inheritance-for-standard-members',
      note: 'The 14-day period and guardian are rules of this fictional plan. Casa’s guide describes a Bitcoin inheritance product with its own waiting period and an owner rejection path.'
    },
    decisions: [
      {
        question: 'What does the missed check-in tell the family?',
        choices: [
          ['The owner has died.', 'Missed activity tells you there may be a problem. Travel, illness, or a lost device can also interrupt a check-in.'],
          ['Assets are ready for immediate release.', 'The case is still inside its challenge window. Look at the timing and approval requirements in the plan.'],
          ['The plan needs review. The owner’s situation is still unknown.', 'The timer starts a review. The case still requires time to challenge a mistaken claim and separate guardian approval.']
        ],
        correct: 2
      },
      {
        update: 'The owner is alive and reachable, but the signing device was lost. The challenge window is still open.',
        question: 'What could pause the fictional plan?',
        choices: [
          ['Contact the designated guardian using the channel in the plan.', 'This plan gives the guardian authority to pause. Contact them through the known channel and confirm the pause before the deadline.'],
          ['Make a small transfer to the old wallet.', 'This example requires an authorized pause or cancellation. An incoming transfer does not count as a check-in.'],
          ['Wait until the deadline has passed.', 'The owner has time to respond now. Waiting uses up the period when the plan can be paused.']
        ],
        correct: 0
      }
    ],
    finish: 'Write down the planned review window, who can pause a mistaken release, and how they confirm the pause if the owner’s main device is missing.'
  },
  family: {
    title: 'You are helping an executor',
    story: 'After a death in the family, the executor finds a statement for a Coinbase account. Your job is to help find the provider’s process.',
    facts: [
      ['Account type', 'Custodial exchange'],
      ['Person who can start', 'The authorized estate representative']
    ],
    source: {
      label: 'Coinbase’s deceased-account guidance',
      href: 'https://help.coinbase.com/en/coinbase/managing-my-account/other/how-do-i-gain-access-to-a-deceased-family-members-coinbase-account',
      note: 'Coinbase describes how a representative can start a claim. The records it requests depend on the location and circumstances.'
    },
    decisions: [
      {
        question: 'Which route should the executor use?',
        choices: [
          ['Use the family’s chat to ask for the account password.', 'Keep account access material private. The provider has a process for reviewing an authorized representative’s request.'],
          ['Open Coinbase’s official estate guidance and follow its claim path.', 'The executor can use that process to learn which documents are needed and how to submit them.'],
          ['Look up a public address and assume it establishes authority.', 'A public address can show recorded activity. The provider needs the evidence listed in its process to assess a claim.']
        ],
        correct: 1
      },
      {
        update: 'A message from an unfamiliar sender says to send the family’s documents in a direct message.',
        question: 'How should the executor proceed?',
        choices: [
          ['Reply to the message with the requested documents.', 'Personal documents belong in the provider’s verified submission process. Find that process from its official help page.'],
          ['Post the documents in the family group so others can decide.', 'Keep those records with the authorized representative. Use the provider’s verified process for anything it requires.'],
          ['Open official support independently and verify where records go.', 'Use the official guide to verify the channel and what the provider requires for this case before sharing records.']
        ],
        correct: 2
      }
    ],
    finish: 'Keep the account type, official claim path, and representative’s role where the authorized person can find them. Keep personal records private.'
  }
};
