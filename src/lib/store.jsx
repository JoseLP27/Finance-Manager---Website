import { validateData } from "./validation";
export { validateData } from "./validation";
import { createContext, useContext, useEffect, useState } from "react";
import { createInitial } from "./finance";
const Context = createContext(null);
const key = "finance-manager-uni-v1";
export function Provider({ children }) {
  const [warning, setWarning] = useState("");
  const [loaded] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      return {
        data: saved ? validateData(JSON.parse(saved)) : createInitial(),
        error: false,
      };
    } catch {
      return { data: createInitial(), error: true };
    }
  });
  const [data, setData] = useState(loaded.data);
  useEffect(() => {
    if (loaded.error) {
      setWarning(
        "No se pudo leer el guardado anterior. No se sobrescribirá: trabaja en esta sesión y descarga un respaldo antes de salir.",
      );
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify(data));
      setWarning("");
    } catch {
      setWarning(
        "No se pudo guardar en este navegador. Descarga un respaldo para conservar tu trabajo.",
      );
    }
  }, [data, loaded]);
  const update = (fn) =>
    setData((old) => {
      const copy = structuredClone(old);
      fn(copy);
      return copy;
    });
  return (
    <Context.Provider value={{ data, update, setData, warning }}>
      {children}
    </Context.Provider>
  );
}
export const useFinance = () => useContext(Context);
