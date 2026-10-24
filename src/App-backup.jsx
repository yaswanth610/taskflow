import { useState, useEffect, useRef } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import ResetPassword from './ResetPassword'
import './App.css'
import Auth from './Auth'
import { supabase } from './supabaseClient'

function App() {
const isResetPasswordPage =
window.location.pathname === '/reset-password'

const [session, setSession] = useState(null)
const [currentPage, setCurrentPage] = useState('dashboard')
const [authLoading, setAuthLoading] = useState(true)

const [tasks, setTasks] = useState([])
const [tasksLoaded, setTasksLoaded] = useState(false)
const [tasksError, setTasksError] = useState('')

const [newTask, setNewTask] = useState('')
const [newPriority, setNewPriority] = useState('Medium')
const [newCategory, setNewCategory] = useState('Work')
const [newDueDate, setNewDueDate] = useState('')

const [filter, setFilter] = useState('All')
const [categoryFilter, setCategoryFilter] = useState('All')
const [searchText, setSearchText] = useState('')

const [darkMode, setDarkMode] = useState(false)
const [notificationsEnabled, setNotificationsEnabled] = useState(false)

const [editingTaskId, setEditingTaskId] = useState(null)
const [editText, setEditText] = useState('')
const [editPriority, setEditPriority] = useState('Medium')
const [editCategory, setEditCategory] = useState('Work')
const [editDueDate, setEditDueDate] = useState('')

const notifiedTasks = useRef(new Set())

useEffect(() => {
let mounted = true

async function loadSession() {
  const { data, error } = await supabase.auth.getSession()

  if (!mounted) return

  if (error) {
    console.error('Could not get session:', error.message)
  }

  setSession(data?.session ?? null)
  setAuthLoading(false)
}

loadSession()

useEffect(() => {
  if (!('serviceWorker' in navigator)) {
  console.log('Service workers are not supported in this browser.')
  return
  }


  navigator.serviceWorker
    .register('/sw.js')
    .then(registration => {
      console.log('TaskFlow service worker registered:', registration.scope)
    })
    .catch(error => {
      console.error('Service worker registration failed:', error)
    })


  }, [])


const {
  data: { subscription },
} = supabase.auth.onAuthStateChange((_event, nextSession) => {
  setSession(nextSession)
  setAuthLoading(false)
})

return () => {
  mounted = false
  subscription.unsubscribe()
}


}, [])

useEffect(() => {
let cancelled = false

async function loadTasks() {
  if (!session?.user?.id) {
    setTasks([])
    setTasksLoaded(false)
    setTasksError('')
    return
  }

  setTasksLoaded(false)
  setTasksError('')

  const { data, error } = await supabase
    .from('tasks')
    .select(
      'id, user_id, text, completed, priority, category, due_date, created_at'
    )
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: true })

  if (cancelled) return

  if (error) {
    console.error('Could not load tasks:', error.message)
    setTasksError('Could not load tasks. Please refresh and try again.')
    setTasks([])
  } else {
    let rows = data || []

    const legacyKey = `taskflow-tasks-${session.user.id}`

    if (rows.length === 0) {
      try {
        const saved = localStorage.getItem(legacyKey)
        const oldTasks = saved ? JSON.parse(saved) : []

        if (Array.isArray(oldTasks) && oldTasks.length > 0) {
          const rowsToInsert = oldTasks.map(task => ({
            user_id: session.user.id,
            text: task.text,
            completed: Boolean(task.completed),
            priority: task.priority || 'Medium',
            category: task.category || 'Work',
            due_date: task.dueDate || null,
          }))

          const { data: importedRows, error: importError } =
            await supabase
              .from('tasks')
              .insert(rowsToInsert)
              .select(
                'id, user_id, text, completed, priority, category, due_date, created_at'
              )

          if (cancelled) return

          if (importError) {
            console.error(
              'Could not import previous tasks:',
              importError.message
            )
          } else {
            rows = importedRows || []
            localStorage.removeItem(legacyKey)
          }
        }
      } catch (importError) {
        console.error('Could not import previous tasks:', importError)
      }
    }

    setTasks(
      rows.map(row => ({
        id: row.id,
        text: row.text,
        completed: row.completed,
        priority: row.priority || 'Medium',
        category: row.category || 'Work',
        dueDate: row.due_date || '',
        createdAt: row.created_at || null,
      }))
    )
  }

  setTasksLoaded(true)
}

loadTasks()

return () => {
  cancelled = true
}

}, [session?.user?.id])

useEffect(() => {
if (!session?.user?.id) {
setDarkMode(false)
setNotificationsEnabled(false)
return
}

const userId = session.user.id

setDarkMode(
  localStorage.getItem(`taskflow-dark-mode-${userId}`) === 'true'
)

setNotificationsEnabled(
  localStorage.getItem(`taskflow-notifications-${userId}`) === 'true' &&
    typeof Notification !== 'undefined' &&
    Notification.permission === 'granted'
)

}, [session?.user?.id])

useEffect(() => {
if (!session?.user?.id) return

localStorage.setItem(
  `taskflow-dark-mode-${session.user.id}`,
  String(darkMode)
)

}, [darkMode, session?.user?.id])

useEffect(() => {
if (
!notificationsEnabled ||
typeof Notification === 'undefined' ||
Notification.permission !== 'granted'
) {
return
}

function checkReminders() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  tasks.forEach(task => {
    if (task.completed || !task.dueDate) return

    const dueDate = new Date(`${task.dueDate}T00:00:00`)
    if (Number.isNaN(dueDate.getTime())) return

    const type =
      dueDate < today
        ? 'overdue'
        : dueDate.getTime() === today.getTime()
          ? 'due-today'
          : null

    if (!type) return

    const key = `${task.id}-${type}-${task.dueDate}`

    if (notifiedTasks.current.has(key)) return

    new Notification(
      type === 'overdue' ? 'Task Overdue' : 'Task Due Today',
      { body: task.text }
    )

    notifiedTasks.current.add(key)
  })
}

checkReminders()

const interval = setInterval(checkReminders, 60000)

return () => clearInterval(interval)

}, [tasks, notificationsEnabled])

async function handleLogout() {
const { error } = await supabase.auth.signOut()

if (error) {
  alert('Could not log out. Please try again.')
}

}

async function addTask(event) {
event.preventDefault()

if (!newTask.trim() || !session?.user?.id) return

const taskToSave = {
  user_id: session.user.id,
  text: newTask.trim(),
  completed: false,
  priority: newPriority,
  category: newCategory,
  due_date: newDueDate || null,
}

const { data, error } = await supabase
  .from('tasks')
  .insert(taskToSave)
  .select('id, text, completed, priority, category, due_date, created_at')
  .single()

if (error) {
  console.error('Could not add task:', error.message)
  alert(`Could not save task: ${error.message}`)
  return
}

setTasks(previous => [
  ...previous,
  {
    id: data.id,
    text: data.text,
    completed: data.completed,
    priority: data.priority || 'Medium',
    category: data.category || 'Work',
    dueDate: data.due_date || '',
    createdAt: data.created_at || null,
  },
])

setNewTask('')
setNewPriority('Medium')
setNewCategory('Work')
setNewDueDate('')

}

async function toggleTask(id) {
const task = tasks.find(item => item.id === id)
if (!task) return

const completed = !task.completed

const { error } = await supabase
  .from('tasks')
  .update({ completed })
  .eq('id', id)
  .eq('user_id', session.user.id)

if (error) {
  alert(`Could not update task: ${error.message}`)
  return
}

setTasks(previous =>
  previous.map(item =>
    item.id === id ? { ...item, completed } : item
  )
)

}

async function deleteTask(id) {
const { error } = await supabase
.from('tasks')
.delete()
.eq('id', id)
.eq('user_id', session.user.id)

if (error) {
  alert(`Could not delete task: ${error.message}`)
  return
}

setTasks(previous => previous.filter(task => task.id !== id))

if (editingTaskId === id) cancelEdit()

}

function startEdit(task) {
setEditingTaskId(task.id)
setEditText(task.text)
setEditPriority(task.priority || 'Medium')
setEditCategory(task.category || 'Work')
setEditDueDate(task.dueDate || '')
}

function cancelEdit() {
setEditingTaskId(null)
setEditText('')
setEditPriority('Medium')
setEditCategory('Work')
setEditDueDate('')
}

async function saveEdit(id) {
if (!editText.trim()) {
alert('Please enter a task name.')
return
}

const updates = {
  text: editText.trim(),
  priority: editPriority,
  category: editCategory,
  due_date: editDueDate || null,
}

const { error } = await supabase
  .from('tasks')
  .update(updates)
  .eq('id', id)
  .eq('user_id', session.user.id)

if (error) {
  alert(`Could not save changes: ${error.message}`)
  return
}

setTasks(previous =>
  previous.map(task =>
    task.id === id
      ? {
          ...task,
          text: updates.text,
          priority: updates.priority,
          category: updates.category,
          dueDate: editDueDate,
        }
      : task
  )
)

cancelEdit()

}

async function toggleNotifications() {
if (!session?.user?.id) return

const key = `taskflow-notifications-${session.user.id}`

if (notificationsEnabled) {
  setNotificationsEnabled(false)
  localStorage.setItem(key, 'false')
  return
}

if (typeof Notification === 'undefined') {
  alert('Your browser does not support notifications.')
  return
}

if (Notification.permission === 'denied') {
  alert('Please allow notifications in your browser settings.')
  return
}

let permission = Notification.permission

if (permission !== 'granted') {
  permission = await Notification.requestPermission()
}

if (permission === 'granted') {
  setNotificationsEnabled(true)
  localStorage.setItem(key, 'true')

  new Notification('TaskFlow Notifications Enabled', {
    body: 'You can now receive task reminders.',
  })
} else {
  setNotificationsEnabled(false)
  localStorage.setItem(key, 'false')
}

}

function getTaskStatus(task) {
if (task.completed) return 'Completed'
if (!task.dueDate) return ''

const today = new Date()
today.setHours(0, 0, 0, 0)

const dueDate = new Date(`${task.dueDate}T00:00:00`)

if (dueDate < today) return 'Overdue'
if (dueDate.getTime() === today.getTime()) return 'Due Today'

return 'Upcoming'

}

const completedCount = tasks.filter(task => task.completed).length
const remainingCount = tasks.length - completedCount

const progressPercentage =
tasks.length === 0
? 0
: Math.round((completedCount / tasks.length) * 100)

const today = new Date()
today.setHours(0, 0, 0, 0)

const overdueCount = tasks.filter(task => {
if (task.completed || !task.dueDate) return false

return new Date(`${task.dueDate}T00:00:00`) < today

}).length

  // Today's date in local time
  const todayKey = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-')

  // Tasks grouped by priority
  const highPriorityCount = tasks.filter(
    task => !task.completed && task.priority === 'High'
  ).length

  const mediumPriorityCount = tasks.filter(
    task => !task.completed && task.priority === 'Medium'
  ).length

  const lowPriorityCount = tasks.filter(
    task => !task.completed && task.priority === 'Low'
  ).length

  // Tasks due soon
  const upcomingTasks = tasks
    .filter(task => {
      if (task.completed || !task.dueDate) return false

      return task.dueDate >= todayKey
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5)

  // Weekly chart data
  // Note: created_at is not currently included in the task objects,
  // so this chart will initially show tasks created on each day only
  // after we add that information in a later step.
  const weeklyProductivity = Array.from({ length: 7 }, (_, index) => {
  const date = new Date(today)
  date.setDate(today.getDate() - (6 - index))

  const dateKey = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')

  const createdCount = tasks.filter(task => {
      if (!task.createdAt) return false

      const createdDate = new Date(task.createdAt)

      const createdKey = [
        createdDate.getFullYear(),
        String(createdDate.getMonth() + 1).padStart(2, '0'),
        String(createdDate.getDate()).padStart(2, '0'),
      ].join('-')

      return createdKey === dateKey
    }).length

    return {
      day: date.toLocaleDateString('en-US', {
        weekday: 'short',
      }),
      date: dateKey,
      created: createdCount,
    }
  })

  // Achievement badges
  const achievements = [
    {
      icon: '🌱',
      title: 'Getting Started',
      description: 'Complete your first task',
      unlocked: completedCount >= 1,
    },
    {
      icon: '⚡',
      title: 'Task Crusher',
      description: 'Complete 10 tasks',
      unlocked: completedCount >= 10,
    },
    {
      icon: '🎯',
      title: 'High Achiever',
      description: 'Complete 50 tasks',
      unlocked: completedCount >= 50,
    },
  ]

  // Monthly calendar data
  const calendarDate = new Date()
  const calendarYear = calendarDate.getFullYear()
  const calendarMonth = calendarDate.getMonth()

  const firstWeekday = new Date(
    calendarYear,
    calendarMonth,
    1
  ).getDay()

  const daysInMonth = new Date(
    calendarYear,
    calendarMonth + 1,
    0
  ).getDate()

  const calendarCells = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]

  function formatCalendarDate(day) {
    if (!day) return ''

    const month = String(calendarMonth + 1).padStart(2, '0')
    const date = String(day).padStart(2, '0')

    return `${calendarYear}-${month}-${date}`
  }

const filteredTasks = tasks.filter(task => {
const matchesFilter =
filter === 'All' ||
(filter === 'Active' && !task.completed) ||
(filter === 'Completed' && task.completed)

const matchesCategory =
  categoryFilter === 'All' ||
  (task.category || 'Work') === categoryFilter

const matchesSearch = task.text
  .toLowerCase()
  .includes(searchText.trim().toLowerCase())

return matchesFilter && matchesCategory && matchesSearch

})

if (isResetPasswordPage) {
return <ResetPassword />
}

if (authLoading) {
return <p>Loading TaskFlow...</p>
}

if (!session) {
return <Auth />
}

if (!tasksLoaded) {
return <p>Loading your tasks...</p>
}

return (
<main className={`dashboard ${darkMode ? 'dark-mode' : ''}`}> <div className="app-shell"> <header className="site-header">
<button
type="button"
className="brand"
onClick={() => setCurrentPage('dashboard')}
aria-label="TaskFlow home"
> <span className="brand-mark">✳</span> <span>
Task<span className="brand-accent">Flow</span> </span> </button>

      <nav className="main-nav" aria-label="Main navigation">
        <button
          type="button"
          className={`main-nav-link ${
            currentPage === 'dashboard' ? 'active' : ''
          }`}
          onClick={() => setCurrentPage('dashboard')}
        >
          Dashboard
        </button>

        <button
          type="button"
          className={`main-nav-link ${
            currentPage === 'tasks' ? 'active' : ''
          }`}
          onClick={() => setCurrentPage('tasks')}
        >
          My Tasks
        </button>

        <button
          type="button"
          className={`main-nav-link ${
            currentPage === 'overview' ? 'active' : ''
          }`}
          onClick={() => setCurrentPage('overview')}
        >
          Overview
        </button>
      </nav>

      <div className="header-actions">
        <button
          type="button"
          className="icon-action"
          onClick={() => {
            setCurrentPage('tasks')
            setSearchText('')
          }}
          aria-label="Open task list"
          title="Open tasks"
        >
          ⌕
        </button>

        <button
          type="button"
          className="header-pill"
          onClick={() => setDarkMode(previous => !previous)}
        >
          {darkMode ? '☀️ Light' : '🌙 Theme'}
        </button>

        <button
          type="button"
          className="header-pill notification-pill"
          onClick={toggleNotifications}
        >
          {notificationsEnabled ? '🔔 Alerts on' : '🔕 Alerts off'}
        </button>

        <div
          className="user-chip"
          title={session.user.email || 'Your account'}
        >
          <span className="user-avatar">
            {(session.user.email || 'T').charAt(0).toUpperCase()}
          </span>
          <span className="user-email">{session.user.email}</span>
        </div>

        <button
          type="button"
          className="logout-button"
          onClick={handleLogout}
        >
          Log out
        </button>
      </div>
    </header>

    {currentPage === 'dashboard' && (
      <>
        <section className="hero-section" id="dashboard">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="eyebrow-dot" /> YOUR PERSONAL WORKSPACE
            </span>

            <h1>
              Make room for
              <br />
              <span>great work.</span>
            </h1>

            <p>
              Plan your day, focus on what matters, and celebrate every
              little win.
            </p>

            <button
              type="button"
              className="hero-cta"
              onClick={() => setCurrentPage('tasks')}
            >
              + Create a task <span aria-hidden="true">↗</span>
            </button>
          </div>

          <div className="hero-art" aria-label="Productivity summary">
            <div className="art-orbit orbit-one" />
            <div className="art-orbit orbit-two" />

            <div className="hero-art-card">
              <span className="art-card-icon">✦</span>
              <span className="art-card-label">YOUR MOMENTUM</span>
              <strong>{progressPercentage}%</strong>
              <span className="art-card-caption">
                of your tasks completed
              </span>

              <div className="art-mini-track">
                <span style={{ width: `${progressPercentage}%` }} />
              </div>

              <div className="art-card-foot">
                <span>Keep it going</span>
                <span>↗</span>
              </div>
            </div>

            <div className="floating-note note-top">
              <span>✓</span> One step at a time
            </div>

            <div className="floating-note note-bottom">
              <span>✦</span> Progress over perfection
            </div>
          </div>
        </section>

        <section className="stats" aria-label="Task statistics">
          <article className="stat-card stat-total">
            <div className="stat-topline">
              <span className="stat-icon">▦</span>
              <span className="stat-caption">ALL YOUR TASKS</span>
            </div>
            <h2>{tasks.length}</h2>
            <p>Total tasks in your workspace</p>
          </article>

          <article className="stat-card stat-completed">
            <div className="stat-topline">
              <span className="stat-icon">✓</span>
              <span className="stat-caption">NICE WORK</span>
            </div>
            <h2>{completedCount}</h2>
            <p>Tasks you've completed</p>
          </article>

          <article className="stat-card stat-remaining">
            <div className="stat-topline">
              <span className="stat-icon">◷</span>
              <span className="stat-caption">UP NEXT</span>
            </div>
            <h2>{remainingCount}</h2>
            <p>Ready for your attention</p>
          </article>
        </section>

        <section className="workspace-grid" id="task-overview">
          <div className="overview-card surface-card">
            <div className="section-title-row">
              <div>
                <span className="section-kicker">YOUR OVERVIEW</span>
                <h2>A little progress goes a long way</h2>
              </div>
              <span className="overview-spark">✦</span>
            </div>

            <div className="progress-summary">
              <div
                className="progress-ring"
                style={{ '--progress': `${progressPercentage}%` }}
              >
                <div className="progress-ring-inner">
                  <strong>{progressPercentage}%</strong>
                  <span>complete</span>
                </div>
              </div>

              <div className="progress-details">
                <h3>
                  {progressPercentage === 100 && tasks.length > 0
                    ? 'Everything checked off!'
                    : progressPercentage >= 60
                      ? "You're on a roll!"
                      : progressPercentage > 0
                        ? "You're making progress!"
                        : 'Your next win starts here.'}
                </h3>

                <p>
                  {completedCount} of {tasks.length}{' '}
                  {tasks.length === 1 ? 'task' : 'tasks'} completed. Every
                  step counts.
                </p>

                <div
                  className="progress-track"
                  role="progressbar"
                  aria-label="Task completion progress"
                  aria-valuenow={progressPercentage}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="progress-fill"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="create-card">
            <div className="create-card-top">
              <span className="create-star">✳</span>
              <span className="create-card-label">MAKE IT HAPPEN</span>
            </div>

            <h2>
              Big goals start
              <br />
              with small tasks.
            </h2>

            <p>Get that thought out of your head and into your plan.</p>

            <button
              type="button"
              className="create-card-link"
              onClick={() => setCurrentPage('tasks')}
            >
              Plan your next move <span>↗</span>
            </button>

            <div className="create-card-decoration">✳</div>
          </div>
        </section>

        {overdueCount > 0 && (
          <div className="overdue-alert" role="status">
            <span className="alert-icon">!</span>
            <div>
              <strong>A little catch-up?</strong>
              <span>
                You have {overdueCount} overdue{' '}
                {overdueCount === 1 ? 'task' : 'tasks'}. Let's get back on
                track.
              </span>
            </div>
          </div>
        )}

        {tasksError && (
          <div className="overdue-alert" role="alert">
            {tasksError}
          </div>
        )}
      </>
    )}

    {currentPage === 'tasks' && (
      <section className="task-panel surface-card" id="task-list">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">YOUR ACTION PLAN</span>
            <h2>
              My task list{' '}
              <span className="task-count-bubble">{tasks.length}</span>
            </h2>
            <p>Small steps. Big momentum. You've got this.</p>
          </div>

          <div className="filter-buttons">
            {['All', 'Active', 'Completed'].map(option => (
              <button
                key={option}
                type="button"
                className={
                  filter === option
                    ? 'filter-button selected'
                    : 'filter-button'
                }
                onClick={() => setFilter(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="task-toolbar">
          <div className="search-container">
            <span className="search-symbol">⌕</span>

            <input
              type="search"
              className="search-input"
              placeholder="Search your tasks..."
              value={searchText}
              onChange={event => setSearchText(event.target.value)}
              aria-label="Search tasks"
            />

            {searchText && (
              <button
                type="button"
                className="clear-search-button"
                onClick={() => setSearchText('')}
              >
                Clear
              </button>
            )}
          </div>

          <div className="category-filter">
            <select
              value={categoryFilter}
              onChange={event => setCategoryFilter(event.target.value)}
              aria-label="Filter by category"
            >
              <option value="All">All categories</option>
              <option value="Work">Work</option>
              <option value="Personal">Personal</option>
              <option value="Study">Study</option>
              <option value="Shopping">Shopping</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        <form className="add-task-form" onSubmit={addTask}>
          <div className="new-task-input-wrap">
            <span>＋</span>

            <input
              type="text"
              placeholder="What would you like to get done?"
              value={newTask}
              onChange={event => setNewTask(event.target.value)}
              aria-label="New task name"
              required
            />
          </div>

          <select
            value={newPriority}
            onChange={event => setNewPriority(event.target.value)}
            aria-label="New task priority"
          >
            <option value="High">High priority</option>
            <option value="Medium">Medium priority</option>
            <option value="Low">Low priority</option>
          </select>

          <select
            value={newCategory}
            onChange={event => setNewCategory(event.target.value)}
            aria-label="New task category"
          >
            <option value="Work">Work</option>
            <option value="Personal">Personal</option>
            <option value="Study">Study</option>
            <option value="Shopping">Shopping</option>
            <option value="Other">Other</option>
          </select>

          <input
            type="date"
            value={newDueDate}
            onChange={event => setNewDueDate(event.target.value)}
            aria-label="Task due date"
          />

          <button type="submit" className="add-task-button">
            Add task <span>＋</span>
          </button>
        </form>

        <div className="task-list">
          {filteredTasks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                {searchText ? '⌕' : '✳'}
              </div>

              <h3>
                {searchText
                  ? 'No matching tasks found'
                  : filter === 'Completed'
                    ? 'No completed tasks yet'
                    : filter === 'Active'
                      ? 'No active tasks'
                      : 'Ready for a fresh start?'}
              </h3>

              <p>
                {searchText
                  ? 'Try another search term.'
                  : 'Add a task above to get started.'}
              </p>
            </div>
          ) : (
            filteredTasks.map(task => (
              <article
                className={`task-item ${
                  task.completed ? 'task-is-complete' : ''
                }`}
                key={task.id}
              >
                <label className="task-label">
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => toggleTask(task.id)}
                    aria-label={`Mark ${task.text} as ${
                      task.completed ? 'active' : 'completed'
                    }`}
                  />

                  {editingTaskId === task.id ? (
                    <div className="edit-fields">
                      <input
                        type="text"
                        value={editText}
                        onChange={event =>
                          setEditText(event.target.value)
                        }
                        aria-label="Edit task name"
                      />

                      <select
                        value={editPriority}
                        onChange={event =>
                          setEditPriority(event.target.value)
                        }
                        aria-label="Edit task priority"
                      >
                        <option value="High">High priority</option>
                        <option value="Medium">Medium priority</option>
                        <option value="Low">Low priority</option>
                      </select>

                      <select
                        value={editCategory}
                        onChange={event =>
                          setEditCategory(event.target.value)
                        }
                        aria-label="Edit task category"
                      >
                        <option value="Work">Work</option>
                        <option value="Personal">Personal</option>
                        <option value="Study">Study</option>
                        <option value="Shopping">Shopping</option>
                        <option value="Other">Other</option>
                      </select>

                      <input
                        type="date"
                        value={editDueDate}
                        onChange={event =>
                          setEditDueDate(event.target.value)
                        }
                        aria-label="Edit task due date"
                      />
                    </div>
                  ) : (
                    <span
                      className={`task-name ${
                        task.completed ? 'completed' : ''
                      }`}
                    >
                      {task.text}
                    </span>
                  )}

                  <span
                    className={`priority-badge ${
                      task.priority?.toLowerCase() || 'medium'
                    }`}
                  >
                    {task.priority || 'Medium'}
                  </span>

                  <span className="category-badge">
                    {task.category || 'Work'}
                  </span>

                  {task.dueDate && (
                    <span className="due-date">
                      ◷ {task.dueDate}
                    </span>
                  )}

                  {task.dueDate && (
                    <span
                      className={`task-status ${getTaskStatus(task)
                        .toLowerCase()
                        .replace(' ', '-')}`}
                    >
                      {getTaskStatus(task)}
                    </span>
                  )}
                </label>

                <div className="task-actions">
                  {editingTaskId === task.id ? (
                    <>
                      <button
                        type="button"
                        className="small-action save-action"
                        onClick={() => saveEdit(task.id)}
                      >
                        Save
                      </button>

                      <button
                        type="button"
                        className="small-action"
                        onClick={cancelEdit}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="small-action"
                      onClick={() => startEdit(task)}
                    >
                      Edit
                    </button>
                  )}

                  <button
                    type="button"
                    className="small-action delete-button"
                    onClick={() => deleteTask(task.id)}
                    aria-label={`Delete ${task.text}`}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))
          )}
        </div>

        <footer className="task-footer">
          <span>
            Showing <strong>{filteredTasks.length}</strong> of{' '}
            <strong>{tasks.length}</strong> tasks
          </span>

          <span>
            <i className="legend-dot legend-orange" /> {completedCount}{' '}
            completed
          </span>
        </footer>

        {tasksError && (
          <div className="overdue-alert" role="alert">
            {tasksError}
          </div>
        )}
      </section>
    )}

    {currentPage === 'overview' && (
      <section className="overview-page surface-card">
        <div className="section-title-row">
          <div>
            <span className="section-kicker">YOUR OVERVIEW</span>
            <h2>Your productivity at a glance</h2>
            <p>Every small step moves you forward.</p>
          </div>

          <span className="overview-spark">✦</span>
        </div>

        <section className="stats" aria-label="Productivity statistics">
          <article className="stat-card stat-total">
            <div className="stat-topline">
              <span className="stat-caption">TOTAL TASKS</span>
            </div>
            <h2>{tasks.length}</h2>
            <p>All your tasks</p>
          </article>

          <article className="stat-card stat-completed">
            <div className="stat-topline">
              <span className="stat-caption">COMPLETED</span>
            </div>
            <h2>{completedCount}</h2>
            <p>Tasks finished</p>
          </article>

          <article className="stat-card stat-remaining">
            <div className="stat-topline">
              <span className="stat-caption">REMAINING</span>
            </div>
            <h2>{remainingCount}</h2>
            <p>Tasks still to do</p>
          </article>
        </section>

    {/* WEEKLY PRODUCTIVITY CHART */}
    <section className="analytics-grid">
      <article className="analytics-card weekly-chart-card">
        <div className="analytics-heading">
          <div>
            <span className="section-kicker">YOUR ACTIVITY</span>
            <h3>Weekly task creation</h3>
            <p>Your task-creating activity over the last 7 days.</p>
          </div>
          <span className="analytics-icon">↗</span>
        </div>

        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={weeklyProductivity}
              margin={{ top: 10, right: 8, left: -22, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--chart-grid, #eee7e1)"
              />
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--chart-text, #827970)', fontSize: 12 }}
                dy={10}
              />
              <YAxis
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--chart-text, #827970)', fontSize: 12 }}
              />
              <Tooltip
                cursor={{ fill: 'rgba(235, 119, 73, 0.08)' }}
                formatter={value => [value, 'Tasks created']}
              />
              <Bar
                dataKey="created"
                name="Tasks created"
                fill="#ed8055"
                radius={[7, 7, 0, 0]}
                maxBarSize={38}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-footer">
          <span>
            <i className="chart-legend-dot" />
            Tasks created per day
          </span>
          <strong>
            {weeklyProductivity.reduce(
              (total, day) => total + day.created,
              0
            )}{' '}
            tasks this week
          </strong>
        </div>
      </article>

      <article className="analytics-card weekly-summary-card">
        <span className="section-kicker">YOUR MOMENTUM</span>
        <h3>Small steps add up.</h3>
        <p>
          Every task you create is a step toward getting things done.
          Keep planning, keep moving, and celebrate your progress.
        </p>

        <div className="weekly-summary-number">
          {weeklyProductivity.reduce(
            (total, day) => total + day.created,
            0
          )}
        </div>

        <span className="weekly-summary-caption">
          Tasks created in the last 7 days
        </span>

        <button
          type="button"
          className="create-card-link"
          onClick={() => setCurrentPage('tasks')}
        >
          Open my tasks <span>↗</span>
        </button>
      </article>
    </section>

  
    {/* MONTHLY CALENDAR */}
    <section className="analytics-card calendar-card">
      <div className="analytics-heading">
        <div>
          <span className="section-kicker">PLAN YOUR MONTH</span>
          <h3>
            {new Date(calendarYear, calendarMonth).toLocaleDateString(
              'en-US',
              { month: 'long', year: 'numeric' }
            )}
          </h3>
          <p>Stay on top of your plans, one day at a time.</p>
        </div>
        <span className="analytics-icon">📅</span>
      </div>

      <div className="calendar-grid">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div className="calendar-weekday" key={day}>
            {day}
          </div>
        ))}

        {calendarCells.map((day, index) => {
          const dateKey = formatCalendarDate(day)
          const isToday = dateKey === todayKey
          const tasksDue = day
            ? tasks.filter(task => task.dueDate === dateKey).length
            : 0

          return (
            <div
              key={`${dateKey || 'empty'}-${index}`}
              className={[
                'calendar-day',
                !day ? 'calendar-empty' : '',
                isToday ? 'calendar-today' : '',
                tasksDue > 0 ? 'calendar-has-tasks' : '',
              ].filter(Boolean).join(' ')}
              title={
                day
                  ? `${dateKey}${tasksDue ? ` — ${tasksDue} task(s) due` : ''}`
                  : ''
              }
            >
              {day && (
                <>
                  <span>{day}</span>
                  {tasksDue > 0 && (
                    <span className="calendar-task-dot" />
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      <div className="calendar-legend">
        <span><i className="calendar-today-key" />Today</span>
        <span><i className="calendar-task-key" />Tasks due</span>
      </div>
    </section>



        <div className="progress-details">
          <h3>Overall completion</h3>
          <p>{progressPercentage}% of your tasks completed</p>

          <div
            className="progress-track"
            role="progressbar"
            aria-label="Overall task completion"
            aria-valuenow={progressPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="progress-fill"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        <div className="overview-summary">
          <p>
            Overdue tasks: <strong>{overdueCount}</strong>
          </p>
          <p>
            Active tasks: <strong>{remainingCount}</strong>
          </p>
        </div>

        {tasksError && (
          <div className="overdue-alert" role="alert">
            {tasksError}
          </div>
        )}
      </section>
    )}

    <footer className="site-footer">
      <span>✳ TaskFlow</span>
      <span>Make today count, one task at a time.</span>
    </footer>
  </div>
</main>

)
}

export default App
