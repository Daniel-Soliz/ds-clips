import assert from "node:assert/strict"
import test from "node:test"
import { ViralMomentsSchema } from "../src/lib/schemas"

test("aceita momento viral válido", () => {
  const result = ViralMomentsSchema.parse([
    {
      start: 10,
      end: 42,
      title: "Um bom gancho",
      viralScore: 91,
      reason: "Abertura forte e conclusão completa.",
      hashtags: ["#conteudo"],
    },
  ])
  assert.equal(result[0].viralScore, 91)
})

test("rejeita nota fora de 0-100", () => {
  assert.throws(() => ViralMomentsSchema.parse([
    {
      start: 10,
      end: 42,
      title: "Teste",
      viralScore: 140,
      reason: "Inválido",
      hashtags: [],
    },
  ]))
})
