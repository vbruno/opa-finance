export function getRecurrenceSummary(
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'yearly',
  endType: 'never' | 'by_occurrences' | 'until_date',
  endOccurrences?: string,
  endDate?: string,
): string {
  const frequencyLabels = {
    weekly: 'Semanal',
    biweekly: 'Quinzenal',
    monthly: 'Mensal',
    yearly: 'Anual',
  }

  const frequencyLabel = frequencyLabels[frequency]

  const endLabels = {
    never: 'sem fim',
    by_occurrences: `${endOccurrences} ocorrência${endOccurrences !== '1' ? 's' : ''}`,
    until_date: `até ${endDate}`,
  }

  const endLabel = endLabels[endType]

  return `${frequencyLabel}, ${endLabel}`
}
