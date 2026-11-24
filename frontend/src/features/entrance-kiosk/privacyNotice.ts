/**
 * Privacy notice for the kiosk device screen, written to rule 3 of the New Zealand Biometric
 * Processing Privacy Code 2025. The summary is the minimum notice shown before a photo is taken:
 * that face recognition is used and for what, the non-camera alternative, and where to read more.
 * The details cover the other rule 3 matters. Every statement must match what the kiosk does.
 */

/** Operator details. A missing optional value leaves its sentence out or uses the fallback text. */
export interface KioskPrivacySettings {
  readonly agencyName: string;
  readonly agencyAddress?: string;
  /** Where people ask to see or correct their information, e.g. an email address. */
  readonly contact?: string;
  /** Trial dates in words, e.g. "from 2 March to 27 March 2027". */
  readonly trialPeriod?: string;
  /** A page that repeats the full notice. */
  readonly infoUrl?: string;
}

/**
 * Address and trial period are marked placeholders for internal testing only. Replace them, and add
 * the privacy contact, before testing with participants; until then the contact falls back to
 * asking the teacher.
 */
export const KIOSK_PRIVACY_SETTINGS: KioskPrivacySettings = {
  agencyName: 'Creative Imagination Lab',
  agencyAddress: 'TEST ONLY — placeholder address, replace before participant testing',
  trialPeriod: 'during internal testing only; participant trial dates are not yet set'
};

/** Matches the server: KioskPayloads keeps evidence photos for 30 days after capture. */
export const KIOSK_PHOTO_RETENTION_DAYS = 30;

export interface KioskPrivacySummary {
  readonly heading: string;
  readonly text: string;
  readonly moreInfo: string;
}

export interface KioskPrivacyItem {
  readonly label: string;
  readonly text: string;
}

const filled = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export function kioskPrivacySummary(settings: KioskPrivacySettings = KIOSK_PRIVACY_SETTINGS): KioskPrivacySummary {
  const url = filled(settings.infoUrl);
  return {
    heading: 'This kiosk uses face recognition.',
    text: 'The camera takes one photo of your face to suggest your name from this class list, so you can '
      + 'confirm your attendance. Prefer not to use the camera? Ask your teacher to mark your attendance.',
    moreInfo: url ? `More information: tap Privacy or visit ${url}.` : 'More information: tap Privacy.'
  };
}

export function kioskPrivacyDetails(settings: KioskPrivacySettings = KIOSK_PRIVACY_SETTINGS): KioskPrivacyItem[] {
  const agency = filled(settings.agencyName) ?? 'The organisation running this kiosk';
  const address = filled(settings.agencyAddress);
  const trial = filled(settings.trialPeriod);
  const contact = filled(settings.contact);
  const url = filled(settings.infoUrl);
  const items: KioskPrivacyItem[] = [
    {
      label: 'Who we are',
      text: `${address ? `${agency}, ${address}` : agency}. This kiosk is a trial${trial ? ` running ${trial}` : ''}.`
    },
    {
      label: 'What we collect',
      text: 'One photo of your face each time you scan at this kiosk. It is compared with the face templates of '
        + 'students in this class who agreed to face check-in.'
    },
    {
      label: 'Why',
      text: 'To suggest your name from this class list. Your attendance is recorded only after you confirm your '
        + 'name. Photos are not used for anything else, including training or improving the face recognition system.'
    },
    {
      label: 'Your choice',
      text: 'Using face check-in is up to you. If you do not use it, your teacher records your attendance in the '
        + 'usual way, with no other effect.'
    },
    {
      label: 'Who can see it',
      text: 'Your teacher sees your attendance record: your name, the time, and present or late. Only '
        + 'administrators can view a kept photo, to check the check-in it belongs to. Photos are not shared '
        + 'with anyone else.'
    },
    {
      // Mirrors KioskPayloads.finish(): CONFIRMED, BLOCKED_NOT_ENROLLED, and ALREADY_RECORDED after
      // choosing the second or third name keep evidence; every other outcome erases the photo.
      label: 'How long we keep it',
      text: 'Your photo is deleted when your scan ends, unless one of these happens: attendance is recorded '
        + 'for the name you confirm; you confirm a name that is not actively enrolled in this class; or you '
        + 'choose a name other than the first suggestion and that student\'s attendance was already recorded. '
        + `In those cases the photo is kept for ${KIOSK_PHOTO_RETENTION_DAYS} days from when it was taken, so `
        + 'an administrator can check the check-in, and is then deleted automatically. Your attendance '
        + 'record is kept like other attendance records.'
    },
    {
      label: 'Your rights',
      text: 'You can ask to see or correct the information we hold about you. '
        + (contact ? `Contact ${contact}. ` : `Ask your teacher how to contact ${agency}. `)
        + 'If you are not satisfied with our response, you can complain to the Privacy Commissioner at privacy.org.nz.'
    }
  ];
  if (url) items.push({ label: 'More information', text: `The full notice is also at ${url}.` });
  return items;
}
