import { useState, useEffect, useCallback } from 'react'
import { Exercise, ExerciseCreate, ExerciseUpdate } from '../types'
import { exerciseClient } from '../api/exerciseClient'
import { toast } from 'react-toastify'

export const useExercises = (autoLoad: boolean = true) => {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadExercises = useCallback(async (isActive?: boolean) => {
    setLoading(true)
    setError(null)
    try {
      const data = await exerciseClient.list(isActive)
      setExercises(data)
      
      // The selection logic is handled in the useEffect below
      
      return data
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load exercises'
      setError(message)
      toast.error(message)
      return []
    } finally {
      setLoading(false)
    }
  }, [selectedExercise])

  const createExercise = useCallback(async (data: ExerciseCreate) => {
    setLoading(true)
    setError(null)
    try {
      const newExercise = await exerciseClient.create(data)
      toast.success('Exercise created successfully')
      
      // Reload exercises to get updated list
      await loadExercises()
      
      // Select the newly created exercise
      setSelectedExercise(newExercise)
      
      return newExercise
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create exercise'
      setError(message)
      toast.error(message)
      throw error
    } finally {
      setLoading(false)
    }
  }, [loadExercises])

  const updateExercise = useCallback(async (id: number, data: ExerciseUpdate) => {
    setLoading(true)
    setError(null)
    try {
      const updatedExercise = await exerciseClient.update(id, data)
      toast.success('Exercise updated successfully')
      
      // Update local state
      setExercises(prev => prev.map(ex => ex.id === id ? updatedExercise : ex))
      
      // Update selected exercise if it's the one being updated
      if (selectedExercise?.id === id) {
        setSelectedExercise(updatedExercise)
      }
      
      return updatedExercise
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update exercise'
      setError(message)
      toast.error(message)
      throw error
    } finally {
      setLoading(false)
    }
  }, [selectedExercise])

  const deleteExercise = useCallback(async (id: number) => {
    setLoading(true)
    setError(null)
    try {
      const result = await exerciseClient.delete(id)
      toast.success(result.message)
      
      // Reload exercises to get updated list
      await loadExercises()
      
      // If deleted exercise was selected, select a different one
      if (selectedExercise?.id === id && exercises.length > 1) {
        const remainingExercises = exercises.filter(ex => ex.id !== id)
        setSelectedExercise(remainingExercises[0] || null)
      }
      
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete exercise'
      setError(message)
      toast.error(message)
      throw error
    } finally {
      setLoading(false)
    }
  }, [selectedExercise, exercises, loadExercises])

  const selectExercise = useCallback((exercise: Exercise | null) => {
    setSelectedExercise(exercise)
    // Store in localStorage for persistence
    if (exercise) {
      localStorage.setItem('selectedExerciseId', String(exercise.id))
    } else {
      localStorage.removeItem('selectedExerciseId')
    }
  }, [])

  const setDefaultExercise = useCallback(async (id: number) => {
    setLoading(true)
    setError(null)
    try {
      const updatedExercise = await exerciseClient.setDefault(id)
      toast.success('Default exercise updated successfully')
      
      // Update local state - unset previous default and set new one
      setExercises(prev => prev.map(ex => ({
        ...ex,
        is_default: ex.id === id
      })))
      
      // Update selected exercise if it's the one being updated
      if (selectedExercise?.id === id) {
        setSelectedExercise(updatedExercise)
      }
      
      return updatedExercise
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to set default exercise'
      setError(message)
      toast.error(message)
      throw error
    } finally {
      setLoading(false)
    }
  }, [selectedExercise])

  // Load exercises on mount if autoLoad is true
  useEffect(() => {
    if (autoLoad) {
      loadExercises()
    }
  }, [autoLoad])

  // Restore selected exercise from localStorage or use default
  useEffect(() => {
    if (exercises.length > 0 && !selectedExercise) {
      const storedId = localStorage.getItem('selectedExerciseId')
      if (storedId) {
        const exercise = exercises.find(ex => ex.id === Number(storedId))
        if (exercise) {
          setSelectedExercise(exercise)
          return
        }
      }
      // If no stored exercise or it wasn't found, select the default
      const defaultExercise = exercises.find(ex => ex.is_default)
      if (defaultExercise) {
        setSelectedExercise(defaultExercise)
        localStorage.setItem('selectedExerciseId', String(defaultExercise.id))
      }
    }
  }, [exercises, selectedExercise])

  return {
    exercises,
    selectedExercise,
    loading,
    error,
    loadExercises,
    createExercise,
    updateExercise,
    deleteExercise,
    selectExercise,
    setDefaultExercise,
  }
}