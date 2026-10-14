// BarDeli Staff 1.0

const SUPABASE_URL = "";

const SUPABASE_KEY = "";

let supabaseClient = null;

function initSupabase() {

  if (!SUPABASE_URL || !SUPABASE_KEY) {

    console.warn("Supabase ще не налаштовано");

    return;

  }

  if (!window.supabase) {

    console.error("Бібліотека Supabase не завантажена");

    return;

  }

  supabaseClient = window.supabase.createClient(

    SUPABASE_URL,

    SUPABASE_KEY

  );

  console.log("BarDeli Staff: Supabase підключено");

}

async function loginEmployee(email, password) {

  if (!supabaseClient) {

    throw new Error("Supabase не підключено");

  }

  const { data, error } =

    await supabaseClient.auth.signInWithPassword({

      email,

      password

    });

  if (error) throw error;

  return data;

}

async function getMyShifts() {

  if (!supabaseClient) {

    throw new Error("Supabase не підключено");

  }

  const { data, error } =

    await supabaseClient.rpc("my_shifts");

  if (error) throw error;

  return data;

}

async function startShift(shiftId) {

  const { data, error } =

    await supabaseClient.rpc("start_my_shift", {

      p_shift_id: shiftId

    });

  if (error) throw error;

  return data;

}

async function endShift(shiftId) {

  const { data, error } =

    await supabaseClient.rpc("end_my_shift", {

      p_shift_id: shiftId

    });

  if (error) throw error;

  return data;

}

document.addEventListener("DOMContentLoaded", initSupabase);
