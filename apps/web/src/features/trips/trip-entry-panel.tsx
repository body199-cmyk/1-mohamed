"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useEntrySession } from "../../demo/entry-session-context";
import { buildContractorStatement } from "@ledger/contractor-statements";
import { calculateTripAmounts } from "@ledger/accounting";
import { validateTripCashOpening, commitTripOrRelease } from "./trip-cash-opening-validation";
import { useDemoStore } from "../../demo/demo-context";
import { TripFormFields } from "./trip-form-fields";
import { TripHistoryPanel } from "./trip-history-panel";
import { TripPreviewCard } from "./trip-preview-card";
import { SharedDataPanel } from "./shared-data-panel";
import { QuickAddModal } from "./quick-add-modal";
import { ReplaceConfirmModal } from "./replace-confirm-modal";
import { NewSessionModal } from "./new-session-modal";
import styles from "./trips.module.css";

export function TripEntryPanel() {
  const {
    contractors,
    vehicles,
    cashOpenings,
    addTrip,
    addVehicle,
    addContractor,
  } = useDemoStore();

  const { state, dispatch, dirty: isDraftDirty, submitted, claimSubmission, releaseSubmission } = useEntrySession();
  const router = useRouter();

  const [quickAddTarget, setQuickAddTarget] = useState<"trip" | "shared">("trip");
  const [quickAddType, setQuickAddType] = useState<"vehicle" | "contractor" | null>(null);
  const [showConfirmReplace, setShowConfirmReplace] = useState(false);
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const tripDraft = state.tripDraft;

  // Selected names for preview
  const selectedContractor = contractors.find((c) => c.id === tripDraft.counterpartyId);
  const selectedVehicle = vehicles.find((v) => v.id === tripDraft.vehicleId);

  const handleStartNewTrip = () => {
    setSuccessBanner(null);
    setValidationError(null);
    if (isDraftDirty) {
      setShowConfirmReplace(true);
    } else {
      dispatch({ type: "START_NEW_TRIP" });
    }
  };

  const handleConfirmReplace = () => {
    dispatch({ type: "START_NEW_TRIP" });
    setShowConfirmReplace(false);
    setValidationError(null);
  };

  const handleAddQuickVehicle = (plate: string, driver: string) => {
    const newV = addVehicle(plate, driver);
    dispatch({ type: "EDIT_TRIP_VEHICLE", vehicleId: newV.id });
  };

  const handleAddQuickContractor = (
    name: string,
    openingDate: string,
    openingBalancePiastres: string
  ) => {
    const newC = addContractor(name, openingDate, openingBalancePiastres);
    dispatch({ type: quickAddTarget === "shared" ? "EDIT_SHARED_COUNTERPARTY" : "EDIT_TRIP_COUNTERPARTY", counterpartyId: newC.id });
  };

  const handleSubmitTrip = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    if (submitted) return;

    if (!tripDraft.workDate) {
      setValidationError("يرجى اختيار تاريخ النقلة.");
      return;
    }
    if (!tripDraft.counterpartyId) {
      setValidationError("يرجى اختيار المقاول الطرف الآخر.");
      return;
    }
    if (!tripDraft.direction) {
      setValidationError("يرجى تحديد اتجاه الشغل (شغل أحمد أو شغل المقاول).");
      return;
    }
    if (!tripDraft.vehicleId) {
      setValidationError("يرجى اختيار السيارة المنفذة للنقلة.");
      return;
    }
    if (!tripDraft.weightTonnes.trim() || tripDraft.weightTonnes === "0") {
      setValidationError("يرجى إدخال وزن صحيح بالطن.");
      return;
    }
    if (!tripDraft.contractorRateEgp.trim()) {
      setValidationError("يرجى إدخال سعر المقاول للطن.");
      return;
    }
    if (!tripDraft.vehicleRateEgp.trim()) {
      setValidationError("يرجى إدخال سعر السيارة للطن.");
      return;
    }

    const calc = calculateTripAmounts({
      weightTonnes: tripDraft.weightTonnes,
      contractorRateEgp: tripDraft.contractorRateEgp,
      vehicleRateEgp: tripDraft.vehicleRateEgp,
      expenseEgp: tripDraft.expenseEgp.trim() === "" ? "0.00" : tripDraft.expenseEgp,
    });

    if (!calc.ok) {
      if (calc.error.code === "EXCESS_PRECISION") {
        setValidationError(
          calc.error.field === "weightTonnes"
            ? "الوزن لا يقبل أكثر من 3 أرقام عشرية."
            : "الأسعار والمبالغ لا تقبل أكثر من رقمين عشريين (قروش)."
        );
      } else {
        setValidationError("صيغة الأرقام المدخلة غير صحيحة.");
      }
      return;
    }

    if (!/[1-9]/.test(tripDraft.weightTonnes)) {
      setValidationError("الوزن يجب أن يكون أكبر من صفر."); return;
    }
    if (!selectedContractor || !selectedVehicle || selectedContractor.isArchived || selectedVehicle.isArchived) {
      setValidationError("اختر عربية ومقاولًا نشطين؛ لا يمكن تسجيل نقلة جديدة على سجل مؤرشف."); return;
    }
    const dateCheck = buildContractorStatement({
      counterpartyId: selectedContractor.id,
      opening: { startDate: selectedContractor.openingDate, signedPiastres: "0" },
      period: { from: tripDraft.workDate, to: tripDraft.workDate }, movements: []
    });
    if (!dateCheck.ok) {
      setValidationError("راجع تاريخ النقلة؛ يجب أن يكون صحيحًا ولا يسبق بداية حساب المقاول."); return;
    }
    const cashCheck = validateTripCashOpening({
      workDate: tripDraft.workDate,
      vehicleId: selectedVehicle.id,
      counterpartyId: selectedContractor.id,
      direction: tripDraft.direction!,
    }, cashOpenings);
    if (!cashCheck.ok) {
      setValidationError(cashCheck.error);
      return;
    }
    if (!claimSubmission()) return;
    setIsSubmitting(true);

    const saved = commitTripOrRelease(() => addTrip({
        workDate: tripDraft.workDate || state.sessionDate,
        counterpartyId: selectedContractor.id,
        vehicleId: selectedVehicle.id,
        direction: tripDraft.direction!,
        origin: tripDraft.origin,
        destination: tripDraft.destination,
        weightTonnes: tripDraft.weightTonnes,
        contractorRateEgp: tripDraft.contractorRateEgp,
        vehicleRateEgp: tripDraft.vehicleRateEgp,
        expenseEgp: tripDraft.expenseEgp.trim() === "" ? "0.00" : tripDraft.expenseEgp,
        contractorTotalPiastres: calc.contractorTotalPiastres,
        vehicleTotalPiastres: calc.vehicleTotalPiastres,
        receiptNumber: tripDraft.receiptNumber,
        notes: tripDraft.notes,
      }), releaseSubmission);
    if (!saved.ok) {
      setValidationError("تعذر حفظ النقلة. راجع البيانات وحاول مرة أخرى؛ لم يتم قفل النموذج.");
      setIsSubmitting(false);
      return;
    }
    const added = saved.value;
    setIsSubmitting(false);
    setSuccessBanner(
      `✓ تم تسجيل النقلة بنجاح (${added.id}). يمكنك الانتقال إلى كشف الحساب لرؤية الأثر المالي فورياً.`
    );
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const mode = submitter?.value === "exit" ? "exit" : "new";
    // Reset the entry session on both successful submit paths. The provider
    // lives in the root layout, so leaving the page without releasing the
    // submission lock would leave the form disabled when the user returns.
    dispatch({ type: "START_NEW_TRIP" });
    if (mode === "exit") router.push("/demo/home");
  };

  return (
    <div>
      {/* Shared Data Panel */}
      <SharedDataPanel
        state={state}
        dispatch={dispatch}
        contractors={contractors.filter(c => !c.isArchived)}
        onOpenNewSession={() => setShowNewSessionModal(true)}
        onOpenQuickAddContractor={() => { setQuickAddTarget("shared"); setQuickAddType("contractor"); }}
      />

      {/* Success Notification */}
      {successBanner && (
        <div className={styles.alertSuccess} role="status" aria-live="polite">
          <span>{successBanner}</span>
          <button
            type="button"
            className={styles.quickActionBtn}
            onClick={() => setSuccessBanner(null)}
          >
            إغلاق ✕
          </button>
        </div>
      )}

      {/* Main Form & Preview Layout */}
      <div className={styles.layoutGrid}>
        {/* Main Column */}
        <div className={styles.mainColumn}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>
                <span>📝 تسجيل نقلة جديدة</span>
              </h2>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={handleStartNewTrip}
              >
                + نقلة جديدة
              </button>
            </div>

            {validationError && (
              <div
                className={styles.card}
                style={{
                  borderColor: "var(--color-danger)",
                  backgroundColor: "#fef2f2",
                  padding: "12px 16px",
                  marginBottom: "16px",
                }}
                role="alert"
              >
                <p style={{ color: "var(--color-danger)", margin: 0, fontWeight: 600 }}>
                  ⚠️ {validationError}
                </p>
              </div>
            )}

            <form onSubmit={handleSubmitTrip} noValidate>
              <fieldset disabled={submitted} style={{ border: 0, minWidth: 0 }}>
              <TripFormFields
                tripDraft={tripDraft}
                dispatch={dispatch}
                contractors={contractors}
                vehicles={vehicles}
                onOpenQuickAddContractor={() => { setQuickAddTarget("trip"); setQuickAddType("contractor"); }}
                onOpenQuickAddVehicle={() => setQuickAddType("vehicle")}
              />

              </fieldset>
              {submitted && <p>أُضيفت هذه النقلة للتجربة. ابدأ نقلة جديدة لإضافة شغل آخر.</p>}
              <div className={styles.btnGroup}>
                <button
                  type="submit"
                  disabled={isSubmitting || submitted}
                  className={styles.btnPrimary}
                  value="new"
                >
                  {isSubmitting ? "جاري الإضافة..." : "💾 حفظ وإضافة نقلة جديدة"}
                </button>

                <button
                  type="submit"
                  value="exit"
                  disabled={isSubmitting || submitted}
                  className={styles.btnSecondary}
                >
                  حفظ وخروج
                </button>

                <button
                  type="button"
                  onClick={handleStartNewTrip}
                  className={styles.btnSecondary}
                >
                  إعادة ضبط النقلة
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Side Column: Live preview */}
        <aside className={styles.sideColumn}>
          <TripPreviewCard
            weightTonnes={tripDraft.weightTonnes}
            contractorRateEgp={tripDraft.contractorRateEgp}
            vehicleRateEgp={tripDraft.vehicleRateEgp}
            expenseEgp={tripDraft.expenseEgp}
            direction={tripDraft.direction}
            counterpartyName={selectedContractor?.name}
            vehiclePlate={selectedVehicle?.plateNumber}
          />
        </aside>
      </div>

      <TripHistoryPanel />

      {/* Modals */}
      <QuickAddModal key={`${quickAddType}-${String(quickAddType !== null)}`}
        type={quickAddType || "vehicle"}
        isOpen={quickAddType !== null}
        onClose={() => setQuickAddType(null)}
        onAddVehicle={handleAddQuickVehicle}
        onAddContractor={handleAddQuickContractor}
        existingContractorNames={contractors.map((item) => item.name)}
        existingVehiclePlates={vehicles.map((item) => item.plateNumber)}
      />

      <ReplaceConfirmModal
        isOpen={showConfirmReplace}
        onConfirm={handleConfirmReplace}
        onCancel={() => setShowConfirmReplace(false)}
      />

      <NewSessionModal key={String(showNewSessionModal)}
        isOpen={showNewSessionModal}
        currentDate={state.sessionDate}
        onClose={() => setShowNewSessionModal(false)}
        onConfirm={(newDate) => {
          dispatch({ type: "START_NEW_SESSION", sessionDate: newDate });
        }}
      />
    </div>
  );
}
