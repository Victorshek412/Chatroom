import { create } from "zustand";

export const useAuthStore = create((set) => ({
  authUser: { name: "Victor", _id: 123, age: 18 },
  isLoggedIn: false,
  isloading: false,

  login: (user) => {
    console.log("We just logged in");
    set({ authUser: user, isLoggedIn: true });
  },
}));
