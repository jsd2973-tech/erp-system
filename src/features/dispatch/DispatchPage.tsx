import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import DispatchList from "./DispatchList";
import DispatchRegister from "./DispatchRegister";
import DispatchBasics from "./DispatchBasics";
import DriverManagement from "./DriverManagement";
import VehicleManagement from "./VehicleManagement";
import type { DispatchCustomer, DispatchDriver, DispatchItem, DispatchLocation, DispatchLocationType, DispatchOrder, DispatchOrderForm, DispatchOrderVehicle, DispatchOrderWithVehicles, DispatchTrip, DispatchVehicle, DispatchView } from "./dispatchTypes";
import { createDispatchId, dispatchToday, toPositiveNumber, calculateEstimatedTrips } from "./dispatchUtils";
import "./dispatch.css";
import "./dispatch-polish.css";

type DispatchPageProps = {