export enum DayOfWeek {
  MONDAY = 'monday',
  TUESDAY = 'tuesday',
  WEDNESDAY = 'wednesday',
  THURSDAY = 'thursday',
  FRIDAY = 'friday',
  SATURDAY = 'saturday',
  SUNDAY = 'sunday',
}

export enum LaboratoryStaffRole {
  MANAGER = 'manager',
  SCIENTIST = 'scientist',
  TECHNICIAN = 'technician',
  PHLEBOTOMIST = 'phlebotomist',
  RECEPTIONIST = 'receptionist',
}

export enum LaboratoryStaffStatus {
  INVITED = 'invited',
  ACTIVE = 'active',
}

export const DAY_OF_WEEK_ORDER: Readonly<Record<DayOfWeek, number>> = {
  [DayOfWeek.MONDAY]: 1,
  [DayOfWeek.TUESDAY]: 2,
  [DayOfWeek.WEDNESDAY]: 3,
  [DayOfWeek.THURSDAY]: 4,
  [DayOfWeek.FRIDAY]: 5,
  [DayOfWeek.SATURDAY]: 6,
  [DayOfWeek.SUNDAY]: 7,
};
