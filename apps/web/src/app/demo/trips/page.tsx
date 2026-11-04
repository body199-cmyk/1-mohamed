import { TripEntryPanel } from "../../../features/trips/trip-entry-panel";

export const metadata = {
  title: "تسجيل النقلات — نظام نقليات النور",
};

export default function DemoTripsPage() {
  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
      <TripEntryPanel />
    </div>
  );
}
