/**
 * IANA time zone that availability slots are scheduled in.
 *
 * The slot write contract carries a calendar date and wall-clock times but no
 * zone, so every slot written through it is local to this zone. The zone is
 * stored on each slot; no instant is ever derived from the server's own clock
 * zone or locale. Accepting another zone is a change to the write contract,
 * not to this value.
 */
export const PLATFORM_SCHEDULING_TIME_ZONE = 'Africa/Lagos';

export const AVAILABILITY_TIME_ZONE_MAX_LENGTH = 64;
