import type {
  ContractorStatementFailure,
  ContractorStatementInput,
  MovementDirection,
  StatementErrorCode,
} from "./statement-types";

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const SIGNED_INTEGER_PATTERN = /^-?\d+$/;
const UNSIGNED_INTEGER_PATTERN = /^\d+$/;

export interface ValidatedMovement {
  readonly id: string;
  readonly workDate: string;
  readonly direction: MovementDirection;
  readonly amountPiastres: bigint;
}

export interface ValidatedStatementInput {
  readonly counterpartyId: string;
  readonly openingStartDate: string;
  readonly openingSignedPiastres: bigint;
  readonly periodFrom: string;
  readonly periodTo: string;
  readonly movements: readonly ValidatedMovement[];
}

export type StatementValidationResult =
  | { readonly ok: true; readonly value: ValidatedStatementInput }
  | ContractorStatementFailure;

function fail(
  code: StatementErrorCode,
  field: string,
  index?: number
): ContractorStatementFailure {
  if (index === undefined) {
    return {
      ok: false,
      error: { code, field },
    };
  }
  return {
    ok: false,
    error: { code, field, index },
  };
}

export function isNonEmptyOpaqueId(value: string): boolean {
  return value.trim().length > 0;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function maxDaysInMonth(year: number, month: number): number {
  switch (month) {
    case 1:
    case 3:
    case 5:
    case 7:
    case 8:
    case 10:
    case 12:
      return 31;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    case 2:
      return isLeapYear(year) ? 29 : 28;
    default:
      return 0;
  }
}

export function isValidLocalDate(value: string): boolean {
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (match === null) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (year < 1 || year > 9999) {
    return false;
  }
  if (month < 1 || month > 12) {
    return false;
  }

  const maxDay = maxDaysInMonth(year, month);
  return day >= 1 && day <= maxDay;
}

export function parseSignedPiastres(value: string): bigint | null {
  if (!SIGNED_INTEGER_PATTERN.test(value)) {
    return null;
  }
  return BigInt(value);
}

export function parseUnsignedPiastres(value: string): bigint | null {
  if (!UNSIGNED_INTEGER_PATTERN.test(value)) {
    return null;
  }
  return BigInt(value);
}

export function validateStatementInput(
  input: ContractorStatementInput
): StatementValidationResult {
  // 1. Account ID
  if (!isNonEmptyOpaqueId(input.counterpartyId)) {
    return fail("INVALID_ID", "counterpartyId");
  }

  // 2. Opening start date
  if (!isValidLocalDate(input.opening.startDate)) {
    return fail("INVALID_DATE", "opening.startDate");
  }

  // 3. Opening signed amount
  const openingSignedPiastres = parseSignedPiastres(
    input.opening.signedPiastres
  );
  if (openingSignedPiastres === null) {
    return fail("INVALID_AMOUNT", "opening.signedPiastres");
  }

  // 4. Period from
  if (!isValidLocalDate(input.period.from)) {
    return fail("INVALID_DATE", "period.from");
  }

  // 5. Period to
  if (!isValidLocalDate(input.period.to)) {
    return fail("INVALID_DATE", "period.to");
  }

  // 6. Period order (from <= to)
  if (input.period.from > input.period.to) {
    return fail("INVALID_PERIOD", "period");
  }

  // 7. Period start relative to opening startDate (period.from >= opening.startDate)
  if (input.period.from < input.opening.startDate) {
    return fail("PERIOD_BEFORE_START", "period.from");
  }

  // 8. Movements in original input order
  const seenIds = new Set<string>();
  const validatedMovements: ValidatedMovement[] = [];

  for (let i = 0; i < input.movements.length; i += 1) {
    const movement = input.movements[i]!;

    // 8a. id
    if (!isNonEmptyOpaqueId(movement.id)) {
      return fail("INVALID_ID", "movements.id", i);
    }

    // 8b. counterpartyId syntax
    if (!isNonEmptyOpaqueId(movement.counterpartyId)) {
      return fail("INVALID_ID", "movements.counterpartyId", i);
    }

    // 8c. counterpartyId matches requested account
    if (movement.counterpartyId !== input.counterpartyId) {
      return fail("ACCOUNT_MISMATCH", "movements.counterpartyId", i);
    }

    // 8d. workDate
    if (!isValidLocalDate(movement.workDate)) {
      return fail("INVALID_DATE", "movements.workDate", i);
    }

    // 8e. contractorTotalPiastres (non-negative integer string)
    const amountPiastres = parseUnsignedPiastres(
      movement.contractorTotalPiastres
    );
    if (amountPiastres === null) {
      return fail("INVALID_AMOUNT", "movements.contractorTotalPiastres", i);
    }

    // 8f. workDate not before opening.startDate
    if (movement.workDate < input.opening.startDate) {
      return fail("MOVEMENT_BEFORE_START", "movements.workDate", i);
    }

    // 8g. Duplicate movement id
    if (seenIds.has(movement.id)) {
      return fail("DUPLICATE_MOVEMENT_ID", "movements.id", i);
    }
    seenIds.add(movement.id);

    validatedMovements.push({
      id: movement.id,
      workDate: movement.workDate,
      direction: movement.direction,
      amountPiastres,
    });
  }

  return {
    ok: true,
    value: {
      counterpartyId: input.counterpartyId,
      openingStartDate: input.opening.startDate,
      openingSignedPiastres,
      periodFrom: input.period.from,
      periodTo: input.period.to,
      movements: validatedMovements,
    },
  };
}
