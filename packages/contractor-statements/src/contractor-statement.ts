import type {
  ContractorStatementInput,
  ContractorStatementResult,
  ContractorStatementRow,
  MovementDirection,
  StatementBeneficiary,
} from "./statement-types";
import {
  type ValidatedMovement,
  validateStatementInput,
} from "./statement-validation";

function compareStringsCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function comparePeriodMovements(
  a: ValidatedMovement,
  b: ValidatedMovement
): number {
  const byDate = compareStringsCodeUnit(a.workDate, b.workDate);
  if (byDate !== 0) {
    return byDate;
  }
  return compareStringsCodeUnit(a.id, b.id);
}

function toSignedDelta(
  direction: MovementDirection,
  amountPiastres: bigint
): bigint {
  return direction === "AHMED_SUPPLIES" ? amountPiastres : -amountPiastres;
}

function resolveBeneficiary(closingBalance: bigint): StatementBeneficiary {
  if (closingBalance > 0n) {
    return "AHMED";
  }
  if (closingBalance < 0n) {
    return "COUNTERPARTY";
  }
  return "BALANCED";
}

function absBigInt(value: bigint): bigint {
  return value < 0n ? -value : value;
}

export function buildContractorStatement(
  input: ContractorStatementInput
): ContractorStatementResult {
  const validation = validateStatementInput(input);
  if (!validation.ok) {
    return validation;
  }

  const {
    counterpartyId,
    openingSignedPiastres,
    periodFrom,
    periodTo,
    movements,
  } = validation.value;

  let openingBalance = openingSignedPiastres;
  const periodMovements: ValidatedMovement[] = [];

  for (let i = 0; i < movements.length; i += 1) {
    const movement = movements[i]!;

    if (movement.workDate < periodFrom) {
      openingBalance += toSignedDelta(
        movement.direction,
        movement.amountPiastres
      );
    } else if (movement.workDate <= periodTo) {
      periodMovements.push(movement);
    }
    // Movements with workDate > periodTo are already validated and excluded from this statement.
  }

  periodMovements.sort(comparePeriodMovements);

  let ahmedWork = 0n;
  let counterpartyWork = 0n;
  let runningBalance = openingBalance;
  const rows: ContractorStatementRow[] = [];

  for (let i = 0; i < periodMovements.length; i += 1) {
    const movement = periodMovements[i]!;
    const signedDelta = toSignedDelta(
      movement.direction,
      movement.amountPiastres
    );

    if (movement.direction === "AHMED_SUPPLIES") {
      ahmedWork += movement.amountPiastres;
    } else {
      counterpartyWork += movement.amountPiastres;
    }

    runningBalance += signedDelta;

    rows.push({
      id: movement.id,
      workDate: movement.workDate,
      direction: movement.direction,
      contractorTotalPiastres: movement.amountPiastres.toString(),
      signedDeltaPiastres: signedDelta.toString(),
      runningBalancePiastres: runningBalance.toString(),
    });
  }

  const closingBalance = openingBalance + ahmedWork - counterpartyWork;
  const beneficiary = resolveBeneficiary(closingBalance);
  const balanceMagnitude = absBigInt(closingBalance);

  return {
    ok: true,
    statement: {
      counterpartyId,
      period: {
        from: periodFrom,
        to: periodTo,
      },
      openingBalancePiastres: openingBalance.toString(),
      ahmedWorkPiastres: ahmedWork.toString(),
      counterpartyWorkPiastres: counterpartyWork.toString(),
      closingBalancePiastres: closingBalance.toString(),
      beneficiary,
      balanceMagnitudePiastres: balanceMagnitude.toString(),
      movementCount: rows.length,
      rows,
    },
  };
}
