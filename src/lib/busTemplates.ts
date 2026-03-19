import type { BusTemplate } from '@/types'

export const BUS_TEMPLATES: BusTemplate[] = [
  // Coaches (2+2 layout, 4 columns)
  {
    id: 'mercedes-tourismo',
    name: 'Mercedes Tourismo',
    category: 'coach',
    rows: 13,
    columns: 4,
    description: 'Standard 2+2 coach, 50 seats',
    seatTypes: {
      // Rows 1-2 premium (A1-A4, B1-B4)
      A1: 'PREMIUM', A2: 'PREMIUM', A3: 'PREMIUM', A4: 'PREMIUM',
      B1: 'PREMIUM', B2: 'PREMIUM', B3: 'PREMIUM', B4: 'PREMIUM',
      // Row 3 col 1 accessible
      C1: 'DISABLED_ACCESSIBLE',
    },
  },
  {
    id: 'setra-s515-hd',
    name: 'Setra S 515 HD',
    category: 'coach',
    rows: 12,
    columns: 4,
    description: 'Premium 2+2 coach, 46 seats',
    seatTypes: {
      A1: 'PREMIUM', A2: 'PREMIUM', A3: 'PREMIUM', A4: 'PREMIUM',
      B1: 'PREMIUM', B2: 'PREMIUM', B3: 'PREMIUM', B4: 'PREMIUM',
      // Row 12 center blocked
      L2: 'BLOCKED', L3: 'BLOCKED',
    },
  },
  {
    id: 'neoplan-cityliner',
    name: 'Neoplan Cityliner',
    category: 'coach',
    rows: 14,
    columns: 4,
    description: 'Large 2+2 coach, 53 seats',
    seatTypes: {
      A1: 'PREMIUM', A2: 'PREMIUM', A3: 'PREMIUM', A4: 'PREMIUM',
      B1: 'PREMIUM', B2: 'PREMIUM', B3: 'PREMIUM', B4: 'PREMIUM',
      C1: 'PREMIUM', C2: 'PREMIUM', C3: 'PREMIUM', C4: 'PREMIUM',
      // Row 4 accessible
      D1: 'DISABLED_ACCESSIBLE',
    },
  },

  // Minibuses (2+1 layout, 3 columns)
  {
    id: 'mercedes-sprinter',
    name: 'Mercedes Sprinter',
    category: 'minibus',
    rows: 8,
    columns: 3,
    description: '2+1 minibus, 20 seats',
    seatTypes: {
      A1: 'PREMIUM', A2: 'PREMIUM', A3: 'PREMIUM',
      B1: 'DISABLED_ACCESSIBLE',
    },
  },
  {
    id: 'iveco-daily',
    name: 'Iveco Daily',
    category: 'minibus',
    rows: 7,
    columns: 3,
    description: '2+1 minibus, 18 seats',
    seatTypes: {
      A1: 'DISABLED_ACCESSIBLE',
      // Row 7 col 3 blocked for luggage
      G3: 'BLOCKED',
    },
  },
  {
    id: 'toyota-coaster',
    name: 'Toyota Coaster',
    category: 'minibus',
    rows: 9,
    columns: 3,
    description: '2+1 minibus, 24 seats',
    seatTypes: {
      A1: 'PREMIUM', A2: 'PREMIUM', A3: 'PREMIUM',
      B1: 'PREMIUM', B2: 'PREMIUM', B3: 'PREMIUM',
    },
  },

  // Microbuses (2+1 layout, 3 columns)
  {
    id: 'ford-transit',
    name: 'Ford Transit',
    category: 'microbus',
    rows: 5,
    columns: 3,
    description: '2+1 compact, 13 seats',
    seatTypes: {},
  },
  {
    id: 'vw-crafter',
    name: 'VW Crafter',
    category: 'microbus',
    rows: 4,
    columns: 3,
    description: '2+1 compact, 10 seats',
    seatTypes: {
      A1: 'PREMIUM', A2: 'PREMIUM', A3: 'PREMIUM',
    },
  },
]
