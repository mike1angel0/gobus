import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from 'bcryptjs';

const BCRYPT_ROUNDS = 12;
const DEFAULT_PASSWORD = 'Password1';

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL']! });
  const prisma = new PrismaClient({ adapter });

  console.log('Seeding database (idempotent)…');

  // ─── Providers ──────────────────────────────────────────────────────────────
  async function upsertProvider(
    name: string,
    contactEmail: string,
    contactPhone: string,
    status: 'APPROVED' | 'PENDING',
  ) {
    const existing = await prisma.provider.findFirst({ where: { name } });
    if (existing) return existing;
    return prisma.provider.create({ data: { name, contactEmail, contactPhone, status } });
  }

  const [providerA, providerB, providerC] = await Promise.all([
    upsertProvider('TransBalkan Express', 'office@transbalkan.ro', '+40700100200', 'APPROVED'),
    upsertProvider('CarpathianBus', 'info@carpathianbus.ro', '+40700300400', 'APPROVED'),
    upsertProvider('DanubeLine', 'contact@danubeline.ro', '+40700500600', 'PENDING'),
  ]);

  // ─── Users ──────────────────────────────────────────────────────────────────
  const passwordHash = await hash(DEFAULT_PASSWORD, BCRYPT_ROUNDS);

  const users = await Promise.all([
    // Admin
    prisma.user.upsert({
      where: { email: 'admin@gobus.ro' },
      update: {},
      create: {
        email: 'admin@gobus.ro',
        name: 'Admin User',
        passwordHash,
        role: 'ADMIN',
      },
    }),
    // Provider admins (one per provider)
    prisma.user.upsert({
      where: { email: 'owner@transbalkan.ro' },
      update: {},
      create: {
        email: 'owner@transbalkan.ro',
        name: 'Ion Popescu',
        passwordHash,
        role: 'PROVIDER',
        providerId: providerA.id,
      },
    }),
    prisma.user.upsert({
      where: { email: 'owner@carpathianbus.ro' },
      update: {},
      create: {
        email: 'owner@carpathianbus.ro',
        name: 'Maria Ionescu',
        passwordHash,
        role: 'PROVIDER',
        providerId: providerB.id,
      },
    }),
    prisma.user.upsert({
      where: { email: 'owner@danubeline.ro' },
      update: {},
      create: {
        email: 'owner@danubeline.ro',
        name: 'Andrei Vasile',
        passwordHash,
        role: 'PROVIDER',
        providerId: providerC.id,
      },
    }),
    // Drivers (one per provider)
    prisma.user.upsert({
      where: { email: 'driver1@transbalkan.ro' },
      update: {},
      create: {
        email: 'driver1@transbalkan.ro',
        name: 'Gheorghe Marin',
        passwordHash,
        role: 'DRIVER',
        providerId: providerA.id,
      },
    }),
    prisma.user.upsert({
      where: { email: 'driver1@carpathianbus.ro' },
      update: {},
      create: {
        email: 'driver1@carpathianbus.ro',
        name: 'Vasile Dumitrescu',
        passwordHash,
        role: 'DRIVER',
        providerId: providerB.id,
      },
    }),
    prisma.user.upsert({
      where: { email: 'driver1@danubeline.ro' },
      update: {},
      create: {
        email: 'driver1@danubeline.ro',
        name: 'Florin Stancu',
        passwordHash,
        role: 'DRIVER',
        providerId: providerC.id,
      },
    }),
    // Passengers
    prisma.user.upsert({
      where: { email: 'passenger1@example.com' },
      update: {},
      create: {
        email: 'passenger1@example.com',
        name: 'Elena Radu',
        passwordHash,
        role: 'PASSENGER',
        phone: '+40712345678',
      },
    }),
    prisma.user.upsert({
      where: { email: 'passenger2@example.com' },
      update: {},
      create: {
        email: 'passenger2@example.com',
        name: 'Cristian Popa',
        passwordHash,
        role: 'PASSENGER',
        phone: '+40723456789',
      },
    }),
  ]);

  const [
    _admin,
    _ownerA,
    _ownerB,
    _ownerC,
    driverA,
    driverB,
    driverC,
    _passenger1,
    _passenger2,
  ] = users;

  // ─── Cities (used as stop names) ───────────────────────────────────────────
  const cities = [
    'București',
    'Cluj-Napoca',
    'Timișoara',
    'Iași',
    'Constanța',
    'Brașov',
    'Sibiu',
    'Craiova',
    'Oradea',
    'Pitești',
    'Ploiești',
    'Târgu Mureș',
    'Alba Iulia',
    'Râmnicu Vâlcea',
    'Arad',
  ];

  // ─── Routes with stops ─────────────────────────────────────────────────────
  // Helper to create a route with its stops (idempotent by name+provider)
  async function upsertRoute(
    name: string,
    providerId: string,
    stopNames: string[],
    coords: Array<[number, number]>,
  ) {
    // Check if route already exists for this provider
    const existing = await prisma.route.findFirst({
      where: { name, providerId },
    });
    if (existing) return existing;

    const route = await prisma.route.create({ data: { name, providerId } });
    await prisma.stop.createMany({
      data: stopNames.map((stopName, i) => ({
        name: stopName,
        lat: coords[i][0],
        lng: coords[i][1],
        orderIndex: i,
        routeId: route.id,
      })),
    });
    return route;
  }

  // 8 routes across 3 providers
  const routes = await Promise.all([
    // Provider A — TransBalkan Express (3 routes)
    upsertRoute('București → Cluj-Napoca', providerA.id, [cities[0], cities[10], cities[5], cities[11], cities[1]], [
      [44.4268, 26.1025], [44.9467, 26.024], [45.6427, 25.5887], [46.5386, 24.5554], [46.7712, 23.6236],
    ]),
    upsertRoute('București → Timișoara', providerA.id, [cities[0], cities[9], cities[13], cities[7], cities[2]], [
      [44.4268, 26.1025], [44.8565, 24.8691], [45.0997, 24.3694], [44.3302, 23.7949], [45.7489, 21.2087],
    ]),
    upsertRoute('București → Constanța', providerA.id, [cities[0], cities[4]], [
      [44.4268, 26.1025], [44.1598, 28.6348],
    ]),
    // Provider B — CarpathianBus (3 routes)
    upsertRoute('Cluj-Napoca → Sibiu', providerB.id, [cities[1], cities[11], cities[12], cities[6]], [
      [46.7712, 23.6236], [46.5386, 24.5554], [46.0677, 23.5695], [45.7983, 24.1256],
    ]),
    upsertRoute('Cluj-Napoca → Oradea', providerB.id, [cities[1], cities[8]], [
      [46.7712, 23.6236], [47.0722, 21.9212],
    ]),
    upsertRoute('Brașov → Iași', providerB.id, [cities[5], cities[11], cities[3]], [
      [45.6427, 25.5887], [46.5386, 24.5554], [47.1585, 27.6014],
    ]),
    // Provider C — DanubeLine (2 routes)
    upsertRoute('Timișoara → Arad', providerC.id, [cities[2], cities[14]], [
      [45.7489, 21.2087], [46.1866, 21.3123],
    ]),
    upsertRoute('Craiova → București', providerC.id, [cities[7], cities[9], cities[0]], [
      [44.3302, 23.7949], [44.8565, 24.8691], [44.4268, 26.1025],
    ]),
  ]);

  // ─── Buses with seat grids ─────────────────────────────────────────────────
  async function upsertBus(
    licensePlate: string,
    model: string,
    rows: number,
    columns: number,
    providerId: string,
  ) {
    const capacity = rows * columns;
    const bus = await prisma.bus.upsert({
      where: { licensePlate },
      update: {},
      create: { licensePlate, model, capacity, rows, columns, providerId },
    });

    // Only create seats if none exist yet
    const seatCount = await prisma.seat.count({ where: { busId: bus.id } });
    if (seatCount > 0) return bus;

    const seatData: Array<{
      row: number;
      column: number;
      label: string;
      type: 'STANDARD' | 'PREMIUM' | 'DISABLED_ACCESSIBLE' | 'BLOCKED';
      price: number;
      isEnabled: boolean;
      busId: string;
    }> = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        const label = `${String.fromCharCode(65 + r)}${c + 1}`;
        const isPremium = r === 0;
        const isAccessible = r === rows - 1 && c === 0;
        const type = isPremium ? 'PREMIUM' : isAccessible ? 'DISABLED_ACCESSIBLE' : 'STANDARD';
        const price = isPremium ? 15 : isAccessible ? 0 : 10;

        seatData.push({
          row: r,
          column: c,
          label,
          type,
          price,
          isEnabled: true,
          busId: bus.id,
        });
      }
    }

    await prisma.seat.createMany({ data: seatData });
    return bus;
  }

  const buses = await Promise.all([
    upsertBus('B-100-TBE', 'Mercedes Tourismo', 10, 4, providerA.id),
    upsertBus('B-200-TBE', 'MAN Lion Coach', 12, 4, providerA.id),
    upsertBus('CJ-100-CB', 'Irizar i6', 10, 4, providerB.id),
    upsertBus('CJ-200-CB', 'Setra S 516 HD', 8, 4, providerB.id),
    upsertBus('TM-100-DL', 'Neoplan Cityliner', 10, 4, providerC.id),
  ]);

  // ─── Schedules with stop times and segment pricing ─────────────────────────
  interface ScheduleInput {
    routeIndex: number;
    busIndex: number;
    driverId: string;
    departureHour: number;
    departureMinute: number;
    durationMinutes: number;
    basePrice: number;
    daysOfWeek: number[];
  }

  const scheduleInputs: ScheduleInput[] = [
    // Provider A routes
    { routeIndex: 0, busIndex: 0, driverId: driverA.id, departureHour: 6, departureMinute: 0, durationMinutes: 480, basePrice: 80, daysOfWeek: [1, 2, 3, 4, 5] },
    { routeIndex: 0, busIndex: 0, driverId: driverA.id, departureHour: 14, departureMinute: 0, durationMinutes: 480, basePrice: 85, daysOfWeek: [1, 2, 3, 4, 5, 6, 7] },
    { routeIndex: 0, busIndex: 1, driverId: driverA.id, departureHour: 22, departureMinute: 0, durationMinutes: 510, basePrice: 75, daysOfWeek: [5, 6, 7] },
    { routeIndex: 1, busIndex: 0, driverId: driverA.id, departureHour: 7, departureMinute: 30, durationMinutes: 540, basePrice: 90, daysOfWeek: [1, 3, 5] },
    { routeIndex: 1, busIndex: 1, driverId: driverA.id, departureHour: 15, departureMinute: 0, durationMinutes: 540, basePrice: 95, daysOfWeek: [2, 4, 6] },
    { routeIndex: 2, busIndex: 1, driverId: driverA.id, departureHour: 8, departureMinute: 0, durationMinutes: 180, basePrice: 45, daysOfWeek: [1, 2, 3, 4, 5, 6, 7] },
    // Provider B routes
    { routeIndex: 3, busIndex: 2, driverId: driverB.id, departureHour: 9, departureMinute: 0, durationMinutes: 240, basePrice: 40, daysOfWeek: [1, 2, 3, 4, 5] },
    { routeIndex: 3, busIndex: 2, driverId: driverB.id, departureHour: 17, departureMinute: 0, durationMinutes: 240, basePrice: 45, daysOfWeek: [1, 2, 3, 4, 5, 6] },
    { routeIndex: 4, busIndex: 3, driverId: driverB.id, departureHour: 10, departureMinute: 0, durationMinutes: 180, basePrice: 35, daysOfWeek: [1, 2, 3, 4, 5, 6, 7] },
    { routeIndex: 5, busIndex: 2, driverId: driverB.id, departureHour: 6, departureMinute: 30, durationMinutes: 420, basePrice: 70, daysOfWeek: [1, 3, 5, 7] },
    { routeIndex: 5, busIndex: 3, driverId: driverB.id, departureHour: 13, departureMinute: 0, durationMinutes: 420, basePrice: 75, daysOfWeek: [2, 4, 6] },
    // Provider C routes
    { routeIndex: 6, busIndex: 4, driverId: driverC.id, departureHour: 7, departureMinute: 0, durationMinutes: 60, basePrice: 15, daysOfWeek: [1, 2, 3, 4, 5, 6, 7] },
    { routeIndex: 6, busIndex: 4, driverId: driverC.id, departureHour: 12, departureMinute: 0, durationMinutes: 60, basePrice: 15, daysOfWeek: [1, 2, 3, 4, 5, 6, 7] },
    { routeIndex: 7, busIndex: 4, driverId: driverC.id, departureHour: 8, departureMinute: 0, durationMinutes: 180, basePrice: 35, daysOfWeek: [1, 2, 3, 4, 5] },
    { routeIndex: 7, busIndex: 4, driverId: driverC.id, departureHour: 16, departureMinute: 0, durationMinutes: 180, basePrice: 40, daysOfWeek: [1, 2, 3, 4, 5, 6] },
  ];

  // Use today's date as reference so seeded schedules are always searchable
  const now = new Date();
  const refDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

  for (const input of scheduleInputs) {
    const route = routes[input.routeIndex];
    const bus = buses[input.busIndex];

    const departure = new Date(refDate);
    departure.setUTCHours(input.departureHour, input.departureMinute, 0, 0);

    const arrival = new Date(departure.getTime() + input.durationMinutes * 60_000);

    // Check if schedule already exists (same route, bus, departure, trip date)
    const existingSchedule = await prisma.schedule.findFirst({
      where: {
        routeId: route.id,
        busId: bus.id,
        departureTime: departure,
        tripDate: refDate,
      },
    });
    if (existingSchedule) continue;

    // Fetch stops for this route to create stop times
    const stops = await prisma.stop.findMany({
      where: { routeId: route.id },
      orderBy: { orderIndex: 'asc' },
    });

    const schedule = await prisma.schedule.create({
      data: {
        routeId: route.id,
        busId: bus.id,
        driverId: input.driverId,
        departureTime: departure,
        arrivalTime: arrival,
        daysOfWeek: input.daysOfWeek,
        basePrice: input.basePrice,
        status: 'ACTIVE',
        tripDate: refDate,
      },
    });

    // Create stop times with evenly distributed arrival/departure + progressive pricing
    const totalStops = stops.length;
    const totalMs = arrival.getTime() - departure.getTime();
    const stopWaitMs = 10 * 60_000; // 10 min stop

    const stopTimesData = stops.map((stop, i) => {
      const fraction = totalStops > 1 ? i / (totalStops - 1) : 0;
      const arrivalMs = departure.getTime() + fraction * totalMs;
      const departureMs = i < totalStops - 1 ? arrivalMs + stopWaitMs : arrivalMs;
      const priceFromStart = Math.round(fraction * input.basePrice * 100) / 100;

      return {
        scheduleId: schedule.id,
        stopName: stop.name,
        arrivalTime: new Date(arrivalMs),
        departureTime: new Date(departureMs),
        orderIndex: i,
        priceFromStart,
      };
    });

    await prisma.stopTime.createMany({ data: stopTimesData });
  }

  // ─── Bus Tracking (GPS positions) ──────────────────────────────────────────
  // Place each bus at a mid-route position to simulate active trips
  const trackingData = [
    // Bus B-100-TBE: on București → Cluj route, near Brașov
    { busId: buses[0].id, lat: 45.6427, lng: 25.5887, speed: 85, heading: 315, currentStopIndex: 2, isActive: true },
    // Bus B-200-TBE: on București → Timișoara route, near Pitești
    { busId: buses[1].id, lat: 44.8565, lng: 24.8691, speed: 92, heading: 270, currentStopIndex: 1, isActive: true },
    // Bus CJ-100-CB: on Cluj → Sibiu route, near Târgu Mureș
    { busId: buses[2].id, lat: 46.5386, lng: 24.5554, speed: 78, heading: 180, currentStopIndex: 1, isActive: true },
    // Bus CJ-200-CB: on Cluj → Oradea route, en route
    { busId: buses[3].id, lat: 46.9200, lng: 22.7700, speed: 88, heading: 250, currentStopIndex: 0, isActive: true },
    // Bus TM-100-DL: on Timișoara → Arad route, midway
    { busId: buses[4].id, lat: 45.9600, lng: 21.2600, speed: 75, heading: 0, currentStopIndex: 0, isActive: true },
  ];

  for (const tracking of trackingData) {
    await prisma.busTracking.upsert({
      where: { busId: tracking.busId },
      update: {
        lat: tracking.lat,
        lng: tracking.lng,
        speed: tracking.speed,
        heading: tracking.heading,
        currentStopIndex: tracking.currentStopIndex,
        isActive: tracking.isActive,
        tripDate: refDate,
      },
      create: {
        busId: tracking.busId,
        lat: tracking.lat,
        lng: tracking.lng,
        speed: tracking.speed,
        heading: tracking.heading,
        currentStopIndex: tracking.currentStopIndex,
        isActive: tracking.isActive,
        tripDate: refDate,
      },
    });
  }

  console.log('Seed complete.');
  console.log(`  Providers: 3`);
  console.log(`  Users: ${users.length} (1 admin, 3 provider admins, 3 drivers, 2 passengers)`);
  console.log(`  Routes: ${routes.length}`);
  console.log(`  Buses: ${buses.length}`);
  console.log(`  Schedules: ${scheduleInputs.length}`);
  console.log(`  Bus tracking: ${trackingData.length}`);
  console.log(`  Default password for all accounts: ${DEFAULT_PASSWORD}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
