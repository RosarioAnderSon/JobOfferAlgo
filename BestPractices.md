# BestPractices

## DOM idempotente por identidad equivalente
- Cuando una extension inyecta UI en un DOM externo y dinamico, la inyeccion debe ser idempotente: antes de agregar una nueva instancia, limpiar o deduplicar instancias existentes del mismo dominio.
- Si la plataforma expone IDs con variantes, no comparar por string literal. Usar una funcion de identidad equivalente/canonica, como `isSameJobId(...)`, para evitar duplicados, perdida de overlays o mezcla visual entre cards.

