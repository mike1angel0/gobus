import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Clear existing data
  await prisma.delay.deleteMany()
  await prisma.booking.deleteMany()
  await prisma.busTracking.deleteMany()
  await prisma.stopTime.deleteMany()
  await prisma.schedule.deleteMany()
  await prisma.seat.deleteMany()
  await prisma.stop.deleteMany()
  await prisma.bus.deleteMany()
  await prisma.route.deleteMany()
  await prisma.user.deleteMany()
  await prisma.provider.deleteMany()

  const password = await bcrypt.hash('password123', 10)

  // Create providers
  const eurolines = await prisma.provider.create({
    data: {
      name: 'EuroLines Express',
      logo: '🚌',
      contactEmail: 'contact@eurolines.eu',
      contactPhone: '+40 21 123 4567',
    },
  })

  const balkanBus = await prisma.provider.create({
    data: {
      name: 'Balkan Bus Co.',
      logo: '🚎',
      contactEmail: 'info@balkanbus.com',
      contactPhone: '+359 2 987 6543',
    },
  })

  const centralEU = await prisma.provider.create({
    data: {
      name: 'Central EU Transit',
      logo: '🚐',
      contactEmail: 'support@centraleu.de',
      contactPhone: '+49 30 555 1234',
    },
  })

  // Create provider users
  await prisma.user.create({
    data: { name: 'EuroLines Admin', email: 'admin@eurolines.eu', password, role: 'PROVIDER', providerId: eurolines.id },
  })
  await prisma.user.create({
    data: { name: 'Balkan Bus Admin', email: 'admin@balkanbus.com', password, role: 'PROVIDER', providerId: balkanBus.id },
  })
  await prisma.user.create({
    data: { name: 'Central EU Admin', email: 'admin@centraleu.de', password, role: 'PROVIDER', providerId: centralEU.id },
  })

  // Create driver users
  const driver1 = await prisma.user.create({
    data: { name: 'Ion Popescu', email: 'ion.driver@eurolines.eu', password, role: 'DRIVER', providerId: eurolines.id },
  })
  const driver2 = await prisma.user.create({
    data: { name: 'Andrei Ionescu', email: 'andrei.driver@eurolines.eu', password, role: 'DRIVER', providerId: eurolines.id },
  })
  const driver3 = await prisma.user.create({
    data: { name: 'Dimitar Petrov', email: 'dimitar.driver@balkanbus.com', password, role: 'DRIVER', providerId: balkanBus.id },
  })

  // Create passenger users
  const passenger1 = await prisma.user.create({
    data: { name: 'Maria Popescu', email: 'maria@example.com', password, role: 'PASSENGER' },
  })
  const passenger2 = await prisma.user.create({
    data: { name: 'Hans Mueller', email: 'hans@example.com', password, role: 'PASSENGER' },
  })

  // Helper to create seats for a bus
  function createSeats(busId: string, rows: number, cols: number, layout: 'standard' | 'premium') {
    const seats: any[] = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Aisle gap at column 2 for 4-column layout
        const seatNum = r * cols + c + 1
        const label = `${String.fromCharCode(65 + r)}${c + 1}`

        let type = 'STANDARD'
        let price = 0

        // First 2 rows are premium
        if (r < 2 && layout === 'premium') type = 'PREMIUM'
        // Last row middle seats blocked (for 4-col layout, block middle-ish)
        if (r === rows - 1 && (c === 1 || c === 2) && cols === 4) type = 'BLOCKED'
        // One disabled-accessible seat
        if (r === 0 && c === 0) type = 'DISABLED_ACCESSIBLE'

        if (type === 'PREMIUM') price = 5
        else if (type === 'DISABLED_ACCESSIBLE') price = 0
        else if (type === 'BLOCKED') price = 0
        else price = 0

        seats.push({ row: r, column: c, label, type, price, busId })
      }
    }
    return seats
  }

  // Create buses for EuroLines (2 buses)
  const bus1 = await prisma.bus.create({
    data: { licensePlate: 'B-123-EUR', model: 'Mercedes Tourismo', capacity: 52, rows: 13, columns: 4, providerId: eurolines.id },
  })
  const bus2 = await prisma.bus.create({
    data: { licensePlate: 'B-456-EUR', model: 'Setra S 516 HD', capacity: 48, rows: 12, columns: 4, providerId: eurolines.id },
  })

  // Create buses for Balkan Bus (2 buses)
  const bus3 = await prisma.bus.create({
    data: { licensePlate: 'SF-789-BKN', model: 'Volvo 9700', capacity: 40, rows: 10, columns: 4, providerId: balkanBus.id },
  })
  const bus4 = await prisma.bus.create({
    data: { licensePlate: 'SF-012-BKN', model: 'MAN Lion\'s Coach', capacity: 52, rows: 13, columns: 4, providerId: balkanBus.id },
  })

  // Create bus for Central EU
  const bus5 = await prisma.bus.create({
    data: { licensePlate: 'DE-345-CEU', model: 'Neoplan Cityliner', capacity: 44, rows: 11, columns: 4, providerId: centralEU.id },
  })

  // Create seats for all buses
  const allSeats = [
    ...createSeats(bus1.id, 13, 4, 'premium'),
    ...createSeats(bus2.id, 12, 4, 'premium'),
    ...createSeats(bus3.id, 10, 4, 'standard'),
    ...createSeats(bus4.id, 13, 4, 'premium'),
    ...createSeats(bus5.id, 11, 4, 'premium'),
  ]
  await prisma.seat.createMany({ data: allSeats })

  // Define city coordinates
  const cities: Record<string, { latitude: number; longitude: number }> = {
    'Bucharest': { latitude: 44.4268, longitude: 26.1025 },
    'Vienna': { latitude: 48.2082, longitude: 16.3738 },
    'Budapest': { latitude: 47.4979, longitude: 19.0402 },
    'Sofia': { latitude: 42.6977, longitude: 23.3219 },
    'Istanbul': { latitude: 41.0082, longitude: 28.9784 },
    'Prague': { latitude: 50.0755, longitude: 14.4378 },
    'Berlin': { latitude: 52.5200, longitude: 13.4050 },
    'Munich': { latitude: 48.1351, longitude: 11.5820 },
    'Belgrade': { latitude: 44.7866, longitude: 20.4489 },
    'Bratislava': { latitude: 48.1486, longitude: 17.1077 },
    'Timisoara': { latitude: 45.7489, longitude: 21.2087 },
    'Cluj-Napoca': { latitude: 46.7712, longitude: 23.6236 },
    'Sibiu': { latitude: 45.7983, longitude: 24.1256 },
    'Plovdiv': { latitude: 42.1354, longitude: 24.7453 },
    'Nuremberg': { latitude: 49.4521, longitude: 11.0767 },
  }

  // ROUTES

  // Route 1: Bucharest → Vienna (EuroLines)
  const route1 = await prisma.route.create({
    data: {
      name: 'Bucharest → Vienna',
      providerId: eurolines.id,
      stops: {
        create: [
          { name: 'Bucharest', ...cities['Bucharest'], orderIndex: 0 },
          { name: 'Sibiu', ...cities['Sibiu'], orderIndex: 1 },
          { name: 'Timisoara', ...cities['Timisoara'], orderIndex: 2 },
          { name: 'Budapest', ...cities['Budapest'], orderIndex: 3 },
          { name: 'Bratislava', ...cities['Bratislava'], orderIndex: 4 },
          { name: 'Vienna', ...cities['Vienna'], orderIndex: 5 },
        ],
      },
    },
  })

  // Route 2: Bucharest → Istanbul (EuroLines)
  const route2 = await prisma.route.create({
    data: {
      name: 'Bucharest → Istanbul',
      providerId: eurolines.id,
      stops: {
        create: [
          { name: 'Bucharest', ...cities['Bucharest'], orderIndex: 0 },
          { name: 'Sofia', ...cities['Sofia'], orderIndex: 1 },
          { name: 'Plovdiv', ...cities['Plovdiv'], orderIndex: 2 },
          { name: 'Istanbul', ...cities['Istanbul'], orderIndex: 3 },
        ],
      },
    },
  })

  // Route 3: Sofia → Budapest (Balkan Bus)
  const route3 = await prisma.route.create({
    data: {
      name: 'Sofia → Budapest',
      providerId: balkanBus.id,
      stops: {
        create: [
          { name: 'Sofia', ...cities['Sofia'], orderIndex: 0 },
          { name: 'Belgrade', ...cities['Belgrade'], orderIndex: 1 },
          { name: 'Budapest', ...cities['Budapest'], orderIndex: 2 },
        ],
      },
    },
  })

  // Route 4: Sofia → Istanbul (Balkan Bus)
  const route4 = await prisma.route.create({
    data: {
      name: 'Sofia → Istanbul',
      providerId: balkanBus.id,
      stops: {
        create: [
          { name: 'Sofia', ...cities['Sofia'], orderIndex: 0 },
          { name: 'Plovdiv', ...cities['Plovdiv'], orderIndex: 1 },
          { name: 'Istanbul', ...cities['Istanbul'], orderIndex: 2 },
        ],
      },
    },
  })

  // Route 5: Budapest → Prague (Central EU)
  const route5 = await prisma.route.create({
    data: {
      name: 'Budapest → Prague',
      providerId: centralEU.id,
      stops: {
        create: [
          { name: 'Budapest', ...cities['Budapest'], orderIndex: 0 },
          { name: 'Bratislava', ...cities['Bratislava'], orderIndex: 1 },
          { name: 'Prague', ...cities['Prague'], orderIndex: 2 },
        ],
      },
    },
  })

  // Route 6: Berlin → Munich (Central EU)
  const route6 = await prisma.route.create({
    data: {
      name: 'Berlin → Munich',
      providerId: centralEU.id,
      stops: {
        create: [
          { name: 'Berlin', ...cities['Berlin'], orderIndex: 0 },
          { name: 'Nuremberg', ...cities['Nuremberg'], orderIndex: 1 },
          { name: 'Munich', ...cities['Munich'], orderIndex: 2 },
        ],
      },
    },
  })

  // Route 7: Prague → Berlin (Central EU)
  const route7 = await prisma.route.create({
    data: {
      name: 'Prague → Berlin',
      providerId: centralEU.id,
      stops: {
        create: [
          { name: 'Prague', ...cities['Prague'], orderIndex: 0 },
          { name: 'Berlin', ...cities['Berlin'], orderIndex: 1 },
        ],
      },
    },
  })

  // Route 8: Bucharest → Budapest (EuroLines)
  const route8 = await prisma.route.create({
    data: {
      name: 'Bucharest → Budapest',
      providerId: eurolines.id,
      stops: {
        create: [
          { name: 'Bucharest', ...cities['Bucharest'], orderIndex: 0 },
          { name: 'Cluj-Napoca', ...cities['Cluj-Napoca'], orderIndex: 1 },
          { name: 'Budapest', ...cities['Budapest'], orderIndex: 2 },
        ],
      },
    },
  })

  // Create today's date string
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]
  const dayAfter = new Date(today)
  dayAfter.setDate(dayAfter.getDate() + 2)
  const dayAfterStr = dayAfter.toISOString().split('T')[0]

  // Create schedules (trips)
  const schedules = await Promise.all([
    // Schedule 1: Bucharest → Vienna, morning
    prisma.schedule.create({
      data: {
        routeId: route1.id, busId: bus1.id, driverId: driver1.id,
        departureTime: '06:00', arrivalTime: '18:00',
        daysOfWeek: '1,2,3,4,5,6,7', basePrice: 45,
        tripDate: todayStr,
        stopTimes: {
          create: [
            { stopName: 'Bucharest', arrivalTime: '06:00', departureTime: '06:00', orderIndex: 0, priceFromStart: 0 },
            { stopName: 'Sibiu', arrivalTime: '09:30', departureTime: '09:45', orderIndex: 1, priceFromStart: 15 },
            { stopName: 'Timisoara', arrivalTime: '12:00', departureTime: '12:15', orderIndex: 2, priceFromStart: 22 },
            { stopName: 'Budapest', arrivalTime: '15:00', departureTime: '15:15', orderIndex: 3, priceFromStart: 32 },
            { stopName: 'Bratislava', arrivalTime: '16:30', departureTime: '16:40', orderIndex: 4, priceFromStart: 38 },
            { stopName: 'Vienna', arrivalTime: '18:00', departureTime: '18:00', orderIndex: 5, priceFromStart: 45 },
          ],
        },
      },
    }),
    // Schedule 2: Bucharest → Vienna, evening
    prisma.schedule.create({
      data: {
        routeId: route1.id, busId: bus2.id, driverId: driver2.id,
        departureTime: '20:00', arrivalTime: '08:00',
        daysOfWeek: '1,3,5,7', basePrice: 40,
        tripDate: todayStr,
        stopTimes: {
          create: [
            { stopName: 'Bucharest', arrivalTime: '20:00', departureTime: '20:00', orderIndex: 0, priceFromStart: 0 },
            { stopName: 'Sibiu', arrivalTime: '23:30', departureTime: '23:45', orderIndex: 1, priceFromStart: 13 },
            { stopName: 'Timisoara', arrivalTime: '02:00', departureTime: '02:15', orderIndex: 2, priceFromStart: 20 },
            { stopName: 'Budapest', arrivalTime: '05:00', departureTime: '05:15', orderIndex: 3, priceFromStart: 29 },
            { stopName: 'Bratislava', arrivalTime: '06:30', departureTime: '06:40', orderIndex: 4, priceFromStart: 34 },
            { stopName: 'Vienna', arrivalTime: '08:00', departureTime: '08:00', orderIndex: 5, priceFromStart: 40 },
          ],
        },
      },
    }),
    // Schedule 3: Bucharest → Istanbul
    prisma.schedule.create({
      data: {
        routeId: route2.id, busId: bus1.id,
        departureTime: '07:00', arrivalTime: '19:00',
        daysOfWeek: '1,2,3,4,5,6,7', basePrice: 50,
        tripDate: tomorrowStr,
        stopTimes: {
          create: [
            { stopName: 'Bucharest', arrivalTime: '07:00', departureTime: '07:00', orderIndex: 0, priceFromStart: 0 },
            { stopName: 'Sofia', arrivalTime: '12:00', departureTime: '12:20', orderIndex: 1, priceFromStart: 25 },
            { stopName: 'Plovdiv', arrivalTime: '14:00', departureTime: '14:15', orderIndex: 2, priceFromStart: 32 },
            { stopName: 'Istanbul', arrivalTime: '19:00', departureTime: '19:00', orderIndex: 3, priceFromStart: 50 },
          ],
        },
      },
    }),
    // Schedule 4: Sofia → Budapest
    prisma.schedule.create({
      data: {
        routeId: route3.id, busId: bus3.id, driverId: driver3.id,
        departureTime: '08:00', arrivalTime: '17:00',
        daysOfWeek: '1,2,3,4,5', basePrice: 35,
        tripDate: todayStr,
        stopTimes: {
          create: [
            { stopName: 'Sofia', arrivalTime: '08:00', departureTime: '08:00', orderIndex: 0, priceFromStart: 0 },
            { stopName: 'Belgrade', arrivalTime: '12:30', departureTime: '12:45', orderIndex: 1, priceFromStart: 18 },
            { stopName: 'Budapest', arrivalTime: '17:00', departureTime: '17:00', orderIndex: 2, priceFromStart: 35 },
          ],
        },
      },
    }),
    // Schedule 5: Sofia → Istanbul
    prisma.schedule.create({
      data: {
        routeId: route4.id, busId: bus4.id,
        departureTime: '09:00', arrivalTime: '17:00',
        daysOfWeek: '1,2,3,4,5,6,7', basePrice: 30,
        tripDate: todayStr,
        stopTimes: {
          create: [
            { stopName: 'Sofia', arrivalTime: '09:00', departureTime: '09:00', orderIndex: 0, priceFromStart: 0 },
            { stopName: 'Plovdiv', arrivalTime: '11:00', departureTime: '11:15', orderIndex: 1, priceFromStart: 12 },
            { stopName: 'Istanbul', arrivalTime: '17:00', departureTime: '17:00', orderIndex: 2, priceFromStart: 30 },
          ],
        },
      },
    }),
    // Schedule 6: Budapest → Prague
    prisma.schedule.create({
      data: {
        routeId: route5.id, busId: bus5.id,
        departureTime: '07:30', arrivalTime: '13:30',
        daysOfWeek: '1,2,3,4,5,6', basePrice: 28,
        tripDate: todayStr,
        stopTimes: {
          create: [
            { stopName: 'Budapest', arrivalTime: '07:30', departureTime: '07:30', orderIndex: 0, priceFromStart: 0 },
            { stopName: 'Bratislava', arrivalTime: '09:30', departureTime: '09:45', orderIndex: 1, priceFromStart: 12 },
            { stopName: 'Prague', arrivalTime: '13:30', departureTime: '13:30', orderIndex: 2, priceFromStart: 28 },
          ],
        },
      },
    }),
    // Schedule 7: Berlin → Munich
    prisma.schedule.create({
      data: {
        routeId: route6.id, busId: bus5.id,
        departureTime: '06:30', arrivalTime: '12:30',
        daysOfWeek: '1,2,3,4,5,6,7', basePrice: 32,
        tripDate: tomorrowStr,
        stopTimes: {
          create: [
            { stopName: 'Berlin', arrivalTime: '06:30', departureTime: '06:30', orderIndex: 0, priceFromStart: 0 },
            { stopName: 'Nuremberg', arrivalTime: '09:30', departureTime: '09:45', orderIndex: 1, priceFromStart: 18 },
            { stopName: 'Munich', arrivalTime: '12:30', departureTime: '12:30', orderIndex: 2, priceFromStart: 32 },
          ],
        },
      },
    }),
    // Schedule 8: Prague → Berlin
    prisma.schedule.create({
      data: {
        routeId: route7.id, busId: bus5.id,
        departureTime: '10:00', arrivalTime: '14:30',
        daysOfWeek: '1,2,3,4,5', basePrice: 25,
        tripDate: tomorrowStr,
        stopTimes: {
          create: [
            { stopName: 'Prague', arrivalTime: '10:00', departureTime: '10:00', orderIndex: 0, priceFromStart: 0 },
            { stopName: 'Berlin', arrivalTime: '14:30', departureTime: '14:30', orderIndex: 1, priceFromStart: 25 },
          ],
        },
      },
    }),
    // Schedule 9: Bucharest → Budapest morning
    prisma.schedule.create({
      data: {
        routeId: route8.id, busId: bus2.id,
        departureTime: '05:30', arrivalTime: '14:00',
        daysOfWeek: '1,2,3,4,5,6,7', basePrice: 30,
        tripDate: todayStr,
        stopTimes: {
          create: [
            { stopName: 'Bucharest', arrivalTime: '05:30', departureTime: '05:30', orderIndex: 0, priceFromStart: 0 },
            { stopName: 'Cluj-Napoca', arrivalTime: '10:00', departureTime: '10:15', orderIndex: 1, priceFromStart: 15 },
            { stopName: 'Budapest', arrivalTime: '14:00', departureTime: '14:00', orderIndex: 2, priceFromStart: 30 },
          ],
        },
      },
    }),
    // Schedule 10: Sofia → Budapest late
    prisma.schedule.create({
      data: {
        routeId: route3.id, busId: bus3.id,
        departureTime: '14:00', arrivalTime: '23:00',
        daysOfWeek: '1,3,5,7', basePrice: 38,
        tripDate: tomorrowStr,
        stopTimes: {
          create: [
            { stopName: 'Sofia', arrivalTime: '14:00', departureTime: '14:00', orderIndex: 0, priceFromStart: 0 },
            { stopName: 'Belgrade', arrivalTime: '18:30', departureTime: '18:45', orderIndex: 1, priceFromStart: 20 },
            { stopName: 'Budapest', arrivalTime: '23:00', departureTime: '23:00', orderIndex: 2, priceFromStart: 38 },
          ],
        },
      },
    }),
    // Schedules for day after tomorrow
    prisma.schedule.create({
      data: {
        routeId: route1.id, busId: bus1.id,
        departureTime: '06:00', arrivalTime: '18:00',
        daysOfWeek: '1,2,3,4,5,6,7', basePrice: 45,
        tripDate: dayAfterStr,
        stopTimes: {
          create: [
            { stopName: 'Bucharest', arrivalTime: '06:00', departureTime: '06:00', orderIndex: 0, priceFromStart: 0 },
            { stopName: 'Sibiu', arrivalTime: '09:30', departureTime: '09:45', orderIndex: 1, priceFromStart: 15 },
            { stopName: 'Timisoara', arrivalTime: '12:00', departureTime: '12:15', orderIndex: 2, priceFromStart: 22 },
            { stopName: 'Budapest', arrivalTime: '15:00', departureTime: '15:15', orderIndex: 3, priceFromStart: 32 },
            { stopName: 'Bratislava', arrivalTime: '16:30', departureTime: '16:40', orderIndex: 4, priceFromStart: 38 },
            { stopName: 'Vienna', arrivalTime: '18:00', departureTime: '18:00', orderIndex: 5, priceFromStart: 45 },
          ],
        },
      },
    }),
    prisma.schedule.create({
      data: {
        routeId: route2.id, busId: bus2.id,
        departureTime: '07:00', arrivalTime: '19:00',
        daysOfWeek: '1,2,3,4,5,6,7', basePrice: 50,
        tripDate: dayAfterStr,
        stopTimes: {
          create: [
            { stopName: 'Bucharest', arrivalTime: '07:00', departureTime: '07:00', orderIndex: 0, priceFromStart: 0 },
            { stopName: 'Sofia', arrivalTime: '12:00', departureTime: '12:20', orderIndex: 1, priceFromStart: 25 },
            { stopName: 'Plovdiv', arrivalTime: '14:00', departureTime: '14:15', orderIndex: 2, priceFromStart: 32 },
            { stopName: 'Istanbul', arrivalTime: '19:00', departureTime: '19:00', orderIndex: 3, priceFromStart: 50 },
          ],
        },
      },
    }),
    prisma.schedule.create({
      data: {
        routeId: route5.id, busId: bus5.id,
        departureTime: '07:30', arrivalTime: '13:30',
        daysOfWeek: '1,2,3,4,5,6', basePrice: 28,
        tripDate: dayAfterStr,
        stopTimes: {
          create: [
            { stopName: 'Budapest', arrivalTime: '07:30', departureTime: '07:30', orderIndex: 0, priceFromStart: 0 },
            { stopName: 'Bratislava', arrivalTime: '09:30', departureTime: '09:45', orderIndex: 1, priceFromStart: 12 },
            { stopName: 'Prague', arrivalTime: '13:30', departureTime: '13:30', orderIndex: 2, priceFromStart: 28 },
          ],
        },
      },
    }),
    prisma.schedule.create({
      data: {
        routeId: route6.id, busId: bus5.id,
        departureTime: '14:00', arrivalTime: '20:00',
        daysOfWeek: '1,2,3,4,5,6,7', basePrice: 35,
        tripDate: dayAfterStr,
        stopTimes: {
          create: [
            { stopName: 'Berlin', arrivalTime: '14:00', departureTime: '14:00', orderIndex: 0, priceFromStart: 0 },
            { stopName: 'Nuremberg', arrivalTime: '17:00', departureTime: '17:15', orderIndex: 1, priceFromStart: 20 },
            { stopName: 'Munich', arrivalTime: '20:00', departureTime: '20:00', orderIndex: 2, priceFromStart: 35 },
          ],
        },
      },
    }),
    prisma.schedule.create({
      data: {
        routeId: route8.id, busId: bus1.id,
        departureTime: '16:00', arrivalTime: '00:30',
        daysOfWeek: '2,4,6', basePrice: 32,
        tripDate: dayAfterStr,
        stopTimes: {
          create: [
            { stopName: 'Bucharest', arrivalTime: '16:00', departureTime: '16:00', orderIndex: 0, priceFromStart: 0 },
            { stopName: 'Cluj-Napoca', arrivalTime: '20:30', departureTime: '20:45', orderIndex: 1, priceFromStart: 16 },
            { stopName: 'Budapest', arrivalTime: '00:30', departureTime: '00:30', orderIndex: 2, priceFromStart: 32 },
          ],
        },
      },
    }),
  ])

  // Create some bookings
  await prisma.booking.create({
    data: {
      userId: passenger1.id,
      scheduleId: schedules[0].id,
      seatLabels: 'A2,A3',
      totalPrice: 90,
      status: 'CONFIRMED',
      boardingStop: 'Bucharest',
      alightingStop: 'Vienna',
      tripDate: todayStr,
    },
  })

  await prisma.booking.create({
    data: {
      userId: passenger2.id,
      scheduleId: schedules[0].id,
      seatLabels: 'B1',
      totalPrice: 45,
      status: 'CONFIRMED',
      boardingStop: 'Bucharest',
      alightingStop: 'Vienna',
      tripDate: todayStr,
    },
  })

  await prisma.booking.create({
    data: {
      userId: passenger1.id,
      scheduleId: schedules[5].id,
      seatLabels: 'C2',
      totalPrice: 28,
      status: 'CONFIRMED',
      boardingStop: 'Budapest',
      alightingStop: 'Prague',
      tripDate: todayStr,
    },
  })

  await prisma.booking.create({
    data: {
      userId: passenger2.id,
      scheduleId: schedules[3].id,
      seatLabels: 'D1,D2',
      totalPrice: 70,
      status: 'CONFIRMED',
      boardingStop: 'Sofia',
      alightingStop: 'Budapest',
      tripDate: todayStr,
    },
  })

  // Create bus tracking for active trips
  await prisma.busTracking.create({
    data: {
      busId: bus1.id,
      latitude: 45.7489,
      longitude: 21.2087,
      speed: 95,
      heading: 315,
      scheduleId: schedules[0].id,
      currentStopIndex: 2,
      isActive: true,
      tripDate: todayStr,
    },
  })

  await prisma.busTracking.create({
    data: {
      busId: bus3.id,
      latitude: 43.7,
      longitude: 21.9,
      speed: 80,
      heading: 340,
      scheduleId: schedules[3].id,
      currentStopIndex: 1,
      isActive: true,
      tripDate: todayStr,
    },
  })

  // Create a delay
  await prisma.delay.create({
    data: {
      scheduleId: schedules[0].id,
      offsetMinutes: 20,
      reason: 'TRAFFIC',
      note: 'Heavy traffic near Timisoara due to road construction',
      tripDate: todayStr,
      active: true,
    },
  })

  console.log('✅ Database seeded successfully!')
  console.log(`📅 Dates: today=${todayStr}, tomorrow=${tomorrowStr}, dayAfter=${dayAfterStr}`)
  console.log(`🚌 Created ${schedules.length} schedules across 8 routes`)
  console.log('\n📝 Demo accounts:')
  console.log('  Provider: admin@eurolines.eu / password123')
  console.log('  Provider: admin@balkanbus.com / password123')
  console.log('  Provider: admin@centraleu.de / password123')
  console.log('  Driver: ion.driver@eurolines.eu / password123')
  console.log('  Driver: andrei.driver@eurolines.eu / password123')
  console.log('  Driver: dimitar.driver@balkanbus.com / password123')
  console.log('  Passenger: maria@example.com / password123')
  console.log('  Passenger: hans@example.com / password123')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
