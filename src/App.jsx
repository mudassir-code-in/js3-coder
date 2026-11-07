import React from 'react'
import Home from './pages/Home'
import { Route, Routes } from 'react-router-dom'
import Course from './pages/Course'

const App = () => {
  return (
    <div>
      <Routes>
        <Route path='/' element={<Home />}/>
        <Route path='/courses' element={<Course />}/>
      </Routes>
    </div>
  )
}

export default App
