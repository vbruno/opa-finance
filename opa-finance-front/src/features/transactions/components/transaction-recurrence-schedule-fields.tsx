import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type TransactionRecurrenceScheduleFieldsProps = {
  // Seção: Agenda
  startDate: string
  onStartDateChange: (value: string) => void
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'yearly'
  onFrequencyChange: (value: 'weekly' | 'biweekly' | 'monthly' | 'yearly') => void

  // Seção: Término
  endType: 'never' | 'by_occurrences' | 'until_date'
  onEndTypeChange: (value: 'never' | 'by_occurrences' | 'until_date') => void
  endOccurrences: string
  onEndOccurrencesChange: (value: string) => void
  endDate: string
  onEndDateChange: (value: string) => void
}

export function TransactionRecurrenceScheduleFields(
  props: TransactionRecurrenceScheduleFieldsProps,
) {
  const {
    startDate,
    onStartDateChange,
    frequency,
    onFrequencyChange,
    endType,
    onEndTypeChange,
    endOccurrences,
    onEndOccurrencesChange,
    endDate,
    onEndDateChange,
  } = props

  const getDayOfWeekLabel = (dateString: string): string => {
    if (!dateString) return '-'
    const date = new Date(dateString + 'T00:00:00')
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
    return days[date.getDay()] || '-'
  }

  const getDayOfMonthFromDate = (dateString: string): string => {
    if (!dateString) return ''
    const date = new Date(dateString + 'T00:00:00')
    return String(date.getDate())
  }

  const getMonthFromDate = (dateString: string): string => {
    if (!dateString) return ''
    const date = new Date(dateString + 'T00:00:00')
    return String(date.getMonth() + 1)
  }

  return (
    <div className="space-y-2.5">
      {/* Seção: Agenda */}
      <div className="rounded-md border border-border/70 bg-background/70 p-2.5 sm:p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Agenda</p>
        <div className={`grid gap-3 ${frequency === 'yearly' ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
          <div className="space-y-2">
            <Label>Data de início</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(event) => {
                onStartDateChange(event.target.value)
              }}
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label>Frequência</Label>
            <Select
              value={frequency}
              onValueChange={(value) =>
                onFrequencyChange(
                  value as 'weekly' | 'biweekly' | 'monthly' | 'yearly',
                )
              }
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[9999]">
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="biweekly">Quinzenal</SelectItem>
                <SelectItem value="monthly">Mensal</SelectItem>
                <SelectItem value="yearly">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Exibir dia da semana para frequência semanal ou quinzenal (read-only, derivado de startDate) */}
          {(frequency === 'weekly' || frequency === 'biweekly') ? (
            <div className="space-y-2">
              <Label>Dia da semana</Label>
              <Input
                type="text"
                value={getDayOfWeekLabel(startDate)}
                readOnly
                tabIndex={-1}
                aria-readonly="true"
                className="h-10 pointer-events-none cursor-default bg-muted"
              />
            </div>
          ) : null}

          {/* Exibir dia do mês para frequência mensal ou anual */}
          {(frequency === 'monthly' || frequency === 'yearly') ? (
            <div className="space-y-2">
              <Label>Dia do mês</Label>
              <Input
                type="text"
                value={getDayOfMonthFromDate(startDate)}
                readOnly
                tabIndex={-1}
                aria-readonly="true"
                className="h-10 pointer-events-none cursor-default bg-muted"
              />
            </div>
          ) : null}

          {/* Exibir mês do ano apenas para frequência anual */}
          {frequency === 'yearly' ? (
            <div className="space-y-2">
              <Label>Mês</Label>
              <Input
                type="text"
                value={getMonthFromDate(startDate)}
                readOnly
                tabIndex={-1}
                aria-readonly="true"
                className="h-10 pointer-events-none cursor-default bg-muted"
              />
            </div>
          ) : null}
        </div>
      </div>

      {/* Seção: Término */}
      <div className="rounded-md border border-border/70 bg-background/70 p-2.5 sm:p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Término</p>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Término</Label>
            <Select
              value={endType}
              onValueChange={(value) =>
                onEndTypeChange(
                  value as 'never' | 'by_occurrences' | 'until_date',
                )
              }
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[9999]">
                <SelectItem value="never">Sem fim</SelectItem>
                <SelectItem value="by_occurrences">Por ocorrências</SelectItem>
                <SelectItem value="until_date">Por data final</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Exibir campo de qtd. ocorrências quando tipo é "por ocorrências" */}
          {endType === 'by_occurrences' ? (
            <div className="space-y-2">
              <Label>Qtd. ocorrências</Label>
              <Input
                type="number"
                min={1}
                value={endOccurrences}
                onChange={(event) => onEndOccurrencesChange(event.target.value)}
                className="h-10"
              />
            </div>
          ) : null}
          {/* Exibir campo de data final quando tipo é "até data" */}
          {endType === 'until_date' ? (
            <div className="space-y-2">
              <Label>Data final</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(event) => onEndDateChange(event.target.value)}
                className="h-10"
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
