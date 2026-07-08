import prisma from "../db.js";

// 1. Get all resource groups, files, and items
export const getResources = async (req, res) => {
  try {
    const resources = await prisma.resourceGroup.findMany({
      include: {
        files: { orderBy: { createdAt: "desc" } },
        items: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { createdAt: "asc" },
    });
    res.status(200).json(resources);
  } catch (error) {
    console.error("Fetch resources error:", error);
    res.status(500).json({ error: "Failed to fetch learning materials." });
  }
};

// 2. Create a new resource group
export const createResourceGroup = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Group name is required." });
    }

    const group = await prisma.resourceGroup.create({
      data: {
        name: name.trim(),
        description: description?.trim() || "",
      },
      include: {
        files: true,
        items: true,
      },
    });

    res.status(201).json(group);
  } catch (error) {
    console.error("Create resource group error:", error);
    res.status(500).json({ error: "Failed to create resource group." });
  }
};

// 3. Delete a resource group
export const deleteResourceGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    await prisma.resourceGroup.delete({
      where: { id: groupId },
    });
    res.status(200).json({ message: "Resource group deleted successfully." });
  } catch (error) {
    console.error("Delete resource group error:", error);
    res.status(500).json({ error: "Failed to delete resource group." });
  }
};

// 4. Add a simulated file to a group
export const addResourceFile = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name, type, size } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "File name is required." });
    }

    // Verify parent group exists
    const groupExists = await prisma.resourceGroup.findUnique({
      where: { id: groupId },
    });
    if (!groupExists) {
      return res.status(404).json({ error: "Resource group not found." });
    }

    const nextFile = await prisma.resourceFile.create({
      data: {
        name: name.trim(),
        type: type || "pdf",
        size: size || "1.0 MB",
        uploadDate: new Date().toISOString().split("T")[0],
        downloads: 0,
        resourceGroupId: groupId,
      },
    });

    res.status(201).json(nextFile);
  } catch (error) {
    console.error("Add resource file error:", error);
    res.status(500).json({ error: "Failed to add resource file." });
  }
};

// 5. Delete a file from a group
export const deleteResourceFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    await prisma.resourceFile.delete({
      where: { id: fileId },
    });
    res.status(200).json({ message: "File deleted successfully." });
  } catch (error) {
    console.error("Delete resource file error:", error);
    res.status(500).json({ error: "Failed to delete file." });
  }
};

// 6. Add a learning item to a group
export const addResourceItem = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { title, points } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Item title is required." });
    }

    const groupExists = await prisma.resourceGroup.findUnique({
      where: { id: groupId },
    });
    if (!groupExists) {
      return res.status(404).json({ error: "Resource group not found." });
    }

    const nextItem = await prisma.resourceItem.create({
      data: {
        title: title.trim(),
        points: Number(points) || 1,
        resourceGroupId: groupId,
      },
    });

    res.status(201).json(nextItem);
  } catch (error) {
    console.error("Add resource item error:", error);
    res.status(500).json({ error: "Failed to add learning item." });
  }
};

// 7. Delete a learning item from a group
export const deleteResourceItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    await prisma.resourceItem.delete({
      where: { id: itemId },
    });
    res.status(200).json({ message: "Learning item deleted successfully." });
  } catch (error) {
    console.error("Delete resource item error:", error);
    res.status(500).json({ error: "Failed to delete learning item." });
  }
};
