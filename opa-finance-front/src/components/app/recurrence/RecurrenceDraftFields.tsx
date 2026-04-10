import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type RecurrenceFrequency = 'weekly' | 'biweekly' | 'monthly' | 'yearly'
type RecurrenceEndType = 'never' | 'by_occurrences' | 'until_date'

type RecurrenceDraftFieldsProps = {
  startDate: string
  onStartDateChange: (value: string) => void
  frequency: RecurrenceFrequency
  onFrequencyChange: (value: RecurrenceFrequency) => void
  dayOfWeek: string
  onDayOfWeekChange: (value: string) => void
  dayOfMonth: string
  onDayOfMonthChange: (value: string) => void
  monthOfYear: string
  onMonthOfYearChange: (value: string) => void
  endType: RecurrenceEndType
  onEndTypeChange: (value: RecurrenceEndType) => void
  endOccurrences: string
  onEndOccurrencesChange: (value: string) => void
  endDate: string
  onEndDateChange: (value: string) => void
}

export function RecurrenceDraftFields({
  startDate,
  onStartDateChange,
  frequency,
  onFrequencyChange,
  dayOfWeek,
  onDayOfWeekChange,
  dayOfMonth,
  onDayOfMonthChange,
  monthOfYear,
  onMonthOfYearChange,
  endType,
  onEndTypeChange,
  endOccurrences,
  onEndOccurrencesChange,
  endDate,
  onEndDateChange,
}: RecurrenceDraftFieldsProps) {
  return (
    <>
      <div className="rounded-md border border-border/70 bg-background/70 p-2.5 sm:p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Agenda</p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Data de início</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(event) => onStartDateChange(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Frequência</Label>
            <Select
              value={frequency}
              onValueChange={(value) =>
                onFrequencyChange(value as RecurrenceFrequency)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="biweekly">Quinzenal</SelectItem>
                <SelectItem value="monthly">Mensal</SelectItem>
                <SelectItem value="yearly">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {(frequency === 'weekly' || frequency === 'biweekly') ? (
            <div className="space-y-2">
              <Label>Dia da semana</Label>
              <Select value={dayOfWeek} onValueChange={onDayOfWeekChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Domingo</SelectItem>
                  <SelectItem value="1">Segunda</SelectItem>
                  <SelectItem value="2">Terça</SelectItem>
                  <SelectItem value="3">Quarta</SelectItem>
                  <SelectItem value="4">Quinta</SelectItem>
                  <SelectItem value="5">Sexta</SelectItem>
                  <SelectItem value="6">Sábado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {(frequency === 'monthly' || frequency === 'yearly') ? (
            <div className="space-y-2">
              <Label>Dia do mês</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={dayOfMonth}
                onChange={(event) => onDayOfMonthChange(event.target.value)}
              />
            </div>
          ) : null}

          {frequency === 'yearly' ? (
            <div className="space-y-2">
              <Label>Mês</Label>
              <Input
                type="number"
                min={1}
                max={12}
                value={monthOfYear}
                onChange={(event) => onMonthOfYearChange(event.target.value)}
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-md border border-border/70 bg-background/70 p-2.5 sm:p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Término</p>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Término</Label>
            <Select
              value={endType}
              onValueChange={(value) => onEndTypeChange(value as RecurrenceEndType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="never">Sem fim</SelectItem>
                <SelectItem value="by_occurrences">Por ocorrências</SelectItem>
                <SelectItem value="until_date">Por data final</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {endType === 'by_occurrences' ? (
            <div className="space-y-2">
              <Label>Qtd. ocorrências</Label>
              <Input
                type="number"
                min={1}
                value={endOccurrences}
                onChange={(event) => onEndOccurrencesChange(event.target.value)}
              />
            </div>
          ) : null}
          {endType === 'until_date' ? (
            <div className="space-y-2">
              <Label>Data final</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(event) => onEndDateChange(event.target.value)}
              />
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}
