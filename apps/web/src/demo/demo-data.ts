import type { DemoContractor, DemoVehicle, DemoTripRecord } from "./demo-types";

export const INITIAL_CONTRACTORS: readonly DemoContractor[] = [
  {
    id: "K1",
    name: "المقاول أحمد علام",
    openingDate: "2026-11-01",
    openingBalancePiastres: "-40000", // رصيد افتتاحي لصالح المقاول 400.00 ج.م
  },
  {
    id: "K2",
    name: "شركة النيل للمقاولات",
    openingDate: "2026-11-01",
    openingBalancePiastres: "0",
  },
  {
    id: "K3",
    name: "مقاولات الصعيد",
    openingDate: "2026-11-01",
    openingBalancePiastres: "25000", // رصيد افتتاحي لصالح أحمد 250.00 ج.م
  },
];

export const INITIAL_VEHICLES: readonly DemoVehicle[] = [
  {
    id: "V1",
    plateNumber: "أ ب ج 1234",
    driverName: "محمد إبراهيم",
  },
  {
    id: "V2",
    plateNumber: "د هـ و 5678",
    driverName: "محمود حسن",
  },
  {
    id: "V3",
    plateNumber: "س ص ع 9012",
    driverName: "علي عبد الله",
  },
];

export const INITIAL_TRIPS: readonly DemoTripRecord[] = [
  {
    id: "TRIP-HIST-001",
    workDate: "2026-11-02",
    counterpartyId: "K1",
    vehicleId: "V1",
    direction: "AHMED_SUPPLIES",
    origin: "محجر السويس",
    destination: "العاصمة الإدارية",
    weightTonnes: "1.000",
    contractorRateEgp: "300.00",
    vehicleRateEgp: "280.00",
    expenseEgp: "0.00",
    contractorTotalPiastres: "30000",
    vehicleTotalPiastres: "28000",
    receiptNumber: "REC-001",
    notes: "نقلة سابقة تجريبية 1",
    createdAt: "2026-11-02T10:00:00.000Z",
  },
  {
    id: "TRIP-HIST-002",
    workDate: "2026-11-05",
    counterpartyId: "K1",
    vehicleId: "V2",
    direction: "AHMED_SUPPLIES",
    origin: "محجر السويس",
    destination: "العاصمة الإدارية",
    weightTonnes: "2.000",
    contractorRateEgp: "500.00",
    vehicleRateEgp: "450.00",
    expenseEgp: "0.00",
    contractorTotalPiastres: "100000",
    vehicleTotalPiastres: "90000",
    receiptNumber: "REC-002",
    notes: "نقلة سابقة تجريبية 2",
    createdAt: "2026-11-05T11:00:00.000Z",
  },
  {
    id: "TRIP-HIST-003",
    workDate: "2026-11-06",
    counterpartyId: "K1",
    vehicleId: "V3",
    direction: "OTHER_SUPPLIES",
    origin: "كسارة حلوان",
    destination: "التجمع الخامس",
    weightTonnes: "1.500",
    contractorRateEgp: "400.00",
    vehicleRateEgp: "350.00",
    expenseEgp: "0.00",
    contractorTotalPiastres: "60000",
    vehicleTotalPiastres: "52500",
    receiptNumber: "REC-003",
    notes: "نقلة سابقة تجريبية 3 (شغل المقاول)",
    createdAt: "2026-11-06T12:00:00.000Z",
  },
];
