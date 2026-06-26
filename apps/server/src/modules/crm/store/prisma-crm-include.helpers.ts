/** Builds the relation include tree for sequence review records. */
export function toSequenceReviewInclude() {
  return {
    account: true,
    contact: true,
    productLine: true,
    mailbox: true,
    policy: true,
    messages: {
      include: {
        openEvent: true
      },
      orderBy: [{ stepIndex: 'asc' as const }, { createdAt: 'asc' as const }]
    }
  };
}

/** Builds the compact inbox-thread list include tree. */
export function toInboxThreadListInclude() {
  return {
    account: true,
    contact: true,
    mailbox: true,
    enrollment: true,
    messages: {
      take: 1,
      orderBy: { receivedAt: 'desc' as const }
    }
  };
}

/** Builds the inbox-thread detail include tree with ordered messages. */
export function toInboxThreadDetailInclude() {
  return {
    account: true,
    contact: true,
    mailbox: true,
    enrollment: true,
    messages: {
      orderBy: { receivedAt: 'asc' as const }
    }
  };
}
