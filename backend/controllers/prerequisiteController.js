import Prerequisite from '../models/Prerequisite.js'
import { isMongoReady } from '../config/db.js'
import { callPython } from '../services/pythonService.js'

export async function getPrerequisites(request, response) {
  try {
    const subject = String(request.query?.subject || 'DSA').trim().toUpperCase()
    if (isMongoReady()) {
      const records = await Prerequisite.find({ subject }).sort({ topic: 1 }).lean()
      if (records && records.length > 0) {
        const prereqMap = {}
        for (const r of records) {
          prereqMap[r.topic] = r.prerequisites || []
        }
        return response.json({
          subject,
          prerequisites: prereqMap,
          count: records.length,
          records: records.map(r => ({
            id: r._id,
            topic: r.topic,
            prerequisites: r.prerequisites,
            isCustom: r.isCustom,
            document: r.document,
          })),
        })
      }
    }
    // Fallback to Python if MongoDB not ready or has no records
    const queryStr = subject ? `?subject=${encodeURIComponent(subject)}` : ''
    const result = await callPython(`/rag/prerequisites${queryStr}`, { timeout: 30000 })
    response.json(result)
  } catch (error) {
    response.status(error.status || 500).json({ error: error.message })
  }
}

export async function createPrerequisite(request, response) {
  try {
    const { subject, topic, prerequisites, createdBy } = request.body || {}
    if (!topic || !String(topic).trim()) {
      return response.status(400).json({ error: 'Topic name is required.' })
    }
    const subj = String(subject || 'DSA').trim().toUpperCase()
    const topicName = String(topic).trim()
    const prereqList = Array.isArray(prerequisites)
      ? prerequisites.map(p => String(p).trim()).filter(Boolean)
      : []

    if (isMongoReady()) {
      const doc = await Prerequisite.findOneAndUpdate(
        { subject: subj, topic: topicName },
        {
          subject: subj,
          topic: topicName,
          prerequisites: prereqList,
          isCustom: true,
          createdBy: createdBy || 'teacher',
        },
        { upsert: true, new: true }
      )


      return response.status(201).json({
        success: true,
        message: `Topic '${topicName}' added to ${subj}.`,
        record: {
          id: doc._id,
          topic: doc.topic,
          prerequisites: doc.prerequisites,
          isCustom: doc.isCustom,
        },
      })
    }
    return response.status(503).json({ error: 'Database is not ready.' })
  } catch (error) {
    response.status(500).json({ error: error.message })
  }
}

export async function updatePrerequisite(request, response) {
  try {
    const { subject, topic, prerequisites } = request.body || {}
    if (!topic || !String(topic).trim()) {
      return response.status(400).json({ error: 'Topic name is required.' })
    }
    const subj = String(subject || 'DSA').trim().toUpperCase()
    const topicName = String(topic).trim()
    const prereqList = Array.isArray(prerequisites)
      ? prerequisites.map(p => String(p).trim()).filter(Boolean)
      : []

    if (isMongoReady()) {
      const doc = await Prerequisite.findOneAndUpdate(
        { subject: subj, topic: topicName },
        { prerequisites: prereqList, isCustom: true },
        { new: true }
      )

      if (!doc) {
        return response.status(404).json({ error: `Topic '${topicName}' not found in ${subj}.` })
      }


      return response.json({
        success: true,
        message: `Prerequisites for '${topicName}' updated.`,
        record: {
          id: doc._id,
          topic: doc.topic,
          prerequisites: doc.prerequisites,
          isCustom: doc.isCustom,
        },
      })
    }
    return response.status(503).json({ error: 'Database is not ready.' })
  } catch (error) {
    response.status(500).json({ error: error.message })
  }
}

export async function deletePrerequisite(request, response) {
  try {
    const subject = String(request.body?.subject || request.query?.subject || 'DSA').trim().toUpperCase()
    const topic = String(request.body?.topic || request.query?.topic || '').trim()

    if (!topic) {
      return response.status(400).json({ error: 'Topic name is required to delete.' })
    }

    if (isMongoReady()) {
      const deleted = await Prerequisite.findOneAndDelete({ subject, topic })
      if (!deleted) {
        return response.status(404).json({ error: `Topic '${topic}' not found in ${subject}.` })
      }


      return response.json({
        success: true,
        message: `Topic '${topic}' deleted from ${subject}.`,
        deletedTopic: topic,
      })
    }
    return response.status(503).json({ error: 'Database is not ready.' })
  } catch (error) {
    response.status(500).json({ error: error.message })
  }
}
