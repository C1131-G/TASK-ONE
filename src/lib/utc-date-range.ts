export interface UtcDateRange {
  readonly from: string;
  readonly to: string;
  readonly fromInstant: string;
  readonly toInstant: string;
}

export const currentUtcMonthRange = (
  monthOffset: number,
  monthCount: number
): UtcDateRange => {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCMonth(start.getUTCMonth() + monthOffset);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + monthCount);
  end.setUTCMilliseconds(end.getUTCMilliseconds() - 1);
  return {
    from: start.toISOString().slice(0, 10),
    fromInstant: start.toISOString(),
    to: end.toISOString().slice(0, 10),
    toInstant: end.toISOString(),
  };
};
