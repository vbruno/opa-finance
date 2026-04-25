import { describe, expect, it } from 'vitest'

import {
  evaluateArithmeticExpression,
  parseExpressionNumber,
  parseExpressionTokens,
  sanitizeExpressionInput,
  tokenizeExpression,
} from '@/lib/expression'

// ---------------------------------------------------------------------------
// parseExpressionNumber
// ---------------------------------------------------------------------------

describe('parseExpressionNumber', () => {
  it('analisa inteiros', () => {
    expect(parseExpressionNumber('0')).toBe(0)
    expect(parseExpressionNumber('42')).toBe(42)
    expect(parseExpressionNumber('1000')).toBe(1000)
  })

  it('analisa decimais com ponto', () => {
    expect(parseExpressionNumber('1.5')).toBe(1.5)
    expect(parseExpressionNumber('0.99')).toBe(0.99)
  })

  it('analisa decimais com vírgula', () => {
    expect(parseExpressionNumber('1,5')).toBe(1.5)
    expect(parseExpressionNumber('0,99')).toBe(0.99)
  })

  it('usa o último separador como decimal (formato pt-BR com milhar)', () => {
    // 1.000,50 → 1000.50
    expect(parseExpressionNumber('1.000,50')).toBe(1000.5)
    // 1,000.50 → 1000.50
    expect(parseExpressionNumber('1,000.50')).toBe(1000.5)
  })

  it('analisa negativos', () => {
    expect(parseExpressionNumber('-5')).toBe(-5)
    expect(parseExpressionNumber('-1,5')).toBe(-1.5)
  })

  it('analisa positivos explícitos', () => {
    expect(parseExpressionNumber('+5')).toBe(5)
  })

  it('retorna null para entrada vazia', () => {
    expect(parseExpressionNumber('')).toBeNull()
    expect(parseExpressionNumber('   ')).toBeNull()
  })

  it('retorna null para separadores sem dígito', () => {
    expect(parseExpressionNumber('.')).toBeNull()
    expect(parseExpressionNumber(',')).toBeNull()
    expect(parseExpressionNumber('-,')).toBeNull()
  })

  it('retorna null para texto não numérico', () => {
    expect(parseExpressionNumber('abc')).toBeNull()
    expect(parseExpressionNumber('1a2')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// tokenizeExpression
// ---------------------------------------------------------------------------

describe('tokenizeExpression', () => {
  it('tokeniza expressão simples', () => {
    expect(tokenizeExpression('1+2')).toEqual([1, '+', 2])
    expect(tokenizeExpression('10-3')).toEqual([10, '-', 3])
    expect(tokenizeExpression('2*3')).toEqual([2, '*', 3])
    expect(tokenizeExpression('9/4')).toEqual([9, '/', 4])
  })

  it('ignora espaços', () => {
    expect(tokenizeExpression('1 + 2')).toEqual([1, '+', 2])
    expect(tokenizeExpression('  5  *  3  ')).toEqual([5, '*', 3])
  })

  it('tokeniza parênteses', () => {
    expect(tokenizeExpression('(1+2)*3')).toEqual(['(', 1, '+', 2, ')', '*', 3])
  })

  it('tokeniza sinal unário como token de operador separado', () => {
    // sinal unário é resolvido pelo parser, não pelo tokenizador
    expect(tokenizeExpression('-5+3')).toEqual(['-', 5, '+', 3])
    expect(tokenizeExpression('+5-1')).toEqual(['+', 5, '-', 1])
  })

  it('retorna null para entrada vazia', () => {
    expect(tokenizeExpression('')).toBeNull()
    expect(tokenizeExpression('   ')).toBeNull()
  })

  it('retorna null para caracteres inválidos', () => {
    expect(tokenizeExpression('1+a')).toBeNull()
    expect(tokenizeExpression('1^2')).toBeNull()
  })

  it('analisa números com vírgula como separador decimal', () => {
    expect(tokenizeExpression('1,5+2,5')).toEqual([1.5, '+', 2.5])
  })
})

// ---------------------------------------------------------------------------
// parseExpressionTokens
// ---------------------------------------------------------------------------

describe('parseExpressionTokens', () => {
  it('avalia adição e subtração', () => {
    expect(parseExpressionTokens([1, '+', 2])).toBe(3)
    expect(parseExpressionTokens([10, '-', 3])).toBe(7)
  })

  it('avalia multiplicação e divisão', () => {
    expect(parseExpressionTokens([2, '*', 3])).toBe(6)
    expect(parseExpressionTokens([9, '/', 4])).toBe(2.25)
  })

  it('respeita precedência * / sobre + -', () => {
    // 1 + 2 * 3 = 7, não 9
    expect(parseExpressionTokens([1, '+', 2, '*', 3])).toBe(7)
    // 10 - 4 / 2 = 8, não 3
    expect(parseExpressionTokens([10, '-', 4, '/', 2])).toBe(8)
  })

  it('avalia parênteses', () => {
    expect(parseExpressionTokens(['(', 1, '+', 2, ')', '*', 3])).toBe(9)
  })

  it('avalia sinal unário negativo', () => {
    expect(parseExpressionTokens(['-', 5, '+', 3])).toBe(-2)
    expect(parseExpressionTokens(['-', '(', 2, '+', 3, ')'])).toBe(-5)
  })

  it('retorna null para divisão por zero', () => {
    expect(parseExpressionTokens([10, '/', 0])).toBeNull()
  })

  it('retorna null para tokens não consumidos (expressão mal-formada)', () => {
    // dois números sem operador
    expect(parseExpressionTokens([1, 2])).toBeNull()
  })

  it('retorna null para parêntese sem fechar', () => {
    expect(parseExpressionTokens(['(', 1, '+', 2])).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// evaluateArithmeticExpression
// ---------------------------------------------------------------------------

describe('evaluateArithmeticExpression', () => {
  it('avalia operações básicas', () => {
    expect(evaluateArithmeticExpression('1+2')).toBe(3)
    expect(evaluateArithmeticExpression('10-3')).toBe(7)
    expect(evaluateArithmeticExpression('2*3')).toBe(6)
    expect(evaluateArithmeticExpression('10/4')).toBe(2.5)
  })

  it('respeita precedência de operadores', () => {
    expect(evaluateArithmeticExpression('1+2*3')).toBe(7)
    expect(evaluateArithmeticExpression('10-4/2')).toBe(8)
  })

  it('respeita parênteses', () => {
    expect(evaluateArithmeticExpression('(1+2)*3')).toBe(9)
    expect(evaluateArithmeticExpression('(10+5)/3')).toBe(5)
    expect(evaluateArithmeticExpression('((2+3)*4)-1')).toBe(19)
  })

  it('aceita sinal unário', () => {
    expect(evaluateArithmeticExpression('-5+3')).toBe(-2)
    expect(evaluateArithmeticExpression('+5-1')).toBe(4)
    expect(evaluateArithmeticExpression('-(2+3)')).toBe(-5)
  })

  it('aceita decimais com vírgula pt-BR', () => {
    expect(evaluateArithmeticExpression('1,5+1,5')).toBe(3)
    expect(evaluateArithmeticExpression('10,00/4')).toBe(2.5)
  })

  it('aceita espaços', () => {
    expect(evaluateArithmeticExpression('1 + 2 * 3')).toBe(7)
  })

  it('retorna null para entrada vazia', () => {
    expect(evaluateArithmeticExpression('')).toBeNull()
    expect(evaluateArithmeticExpression('   ')).toBeNull()
  })

  it('retorna null para divisão por zero', () => {
    expect(evaluateArithmeticExpression('10/0')).toBeNull()
    expect(evaluateArithmeticExpression('(5-5)/0')).toBeNull()
  })

  it('retorna null para expressão inválida', () => {
    expect(evaluateArithmeticExpression('abc')).toBeNull()
    expect(evaluateArithmeticExpression('1+')).toBeNull()
    expect(evaluateArithmeticExpression('*2')).toBeNull()
    expect(evaluateArithmeticExpression('1+2)')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// sanitizeExpressionInput
// ---------------------------------------------------------------------------

describe('sanitizeExpressionInput', () => {
  it('retorna valor inalterado quando não começa com =', () => {
    expect(sanitizeExpressionInput('100')).toBe('100')
    expect(sanitizeExpressionInput('hello')).toBe('hello')
    expect(sanitizeExpressionInput('')).toBe('')
  })

  it('mantém expressão válida intacta', () => {
    expect(sanitizeExpressionInput('=1+2')).toBe('=1+2')
    expect(sanitizeExpressionInput('=1,5*2')).toBe('=1,5*2')
    expect(sanitizeExpressionInput('=(1+2)*3')).toBe('=(1+2)*3')
  })

  it('remove caracteres inválidos do corpo da expressão', () => {
    expect(sanitizeExpressionInput('=1+2abc')).toBe('=1+2')
    expect(sanitizeExpressionInput('=1^2')).toBe('=12')
    expect(sanitizeExpressionInput('=alert()')).toBe('=()')
  })

  it('preserva espaços dentro da expressão', () => {
    expect(sanitizeExpressionInput('=1 + 2')).toBe('=1 + 2')
  })

  it('trata espaço inicial antes do = corretamente', () => {
    expect(sanitizeExpressionInput('  =1+2')).toBe('=1+2')
  })
})
