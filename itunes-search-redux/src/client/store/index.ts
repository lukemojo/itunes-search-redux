import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import searchReducer from './searchSlice';

/** Builds a fresh store — a factory so every test gets isolated state. */
export const makeStore = () =>
  configureStore({
    reducer: { search: searchReducer },
  });

export type AppStore = ReturnType<typeof makeStore>;
/** Root state: each slice mounts under its key ({ search: SearchState }). */
export type RootState = ReturnType<AppStore['getState']>;
/** Store dispatch, aware of thunks (plain useDispatch types drop them). */
export type AppDispatch = AppStore['dispatch'];

/** useDispatch pre-typed for this store — use instead of plain useDispatch. */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
/** useSelector pre-typed for this store — use instead of plain useSelector. */
export const useAppSelector = useSelector.withTypes<RootState>();
